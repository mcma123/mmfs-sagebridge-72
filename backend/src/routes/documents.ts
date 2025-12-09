import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';
import crypto from 'crypto';
import { SupabaseProvider } from '../storage/providers/SupabaseProvider';
import upload from '../middleware/upload';
import PDFDocument from 'pdfkit';
import { parseDocxToBlocks, applyBlocksToDocx, type DocxContent } from '../docx/DocxEditor';

export const documentsRouter = Router();

const SUPPORTED_EDIT_EXTENSIONS = ['docx'] as const;

async function getDocumentRecord(pool: any, id: number) {
  const result = await pool.query('SELECT * FROM dms.documents WHERE id = $1 AND deleted_at IS NULL', [id]);
  return result.rows[0];
}

async function createPdfFromText(text: string): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    doc.fontSize(12);
    doc.text(text || '', {
      width: 500,
      align: 'left',
    });

    doc.end();
  });
}

function flattenDocxContentToText(content: DocxContent): string {
  const parts: string[] = [];

  for (const block of content.blocks) {
    if (block.type === 'paragraph') {
      if (block.text && block.text.trim()) {
        parts.push(block.text);
      }
    } else if (block.type === 'table') {
      for (const row of block.rows) {
        const rowText = row.cells.map((c) => (c.text || '').trim()).join('\t');
        if (rowText.trim()) {
          parts.push(rowText);
        }
      }
    }
  }

  return parts.join('\n\n');
}

// POST /folders/:id/upload – upload file(s)
documentsRouter.post('/folders/:id/upload', authorize('Editor'), upload.array('files', 10), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  if (!storageClient) {
    return res.status(500).json({ error: { code: 'NO_STORAGE', message: 'Supabase storage not initialized' } });
  }

  // Get uploaded files from multer
  const files = (req.files as Express.Multer.File[]) || [];

  if (files.length === 0) {
    return res.status(400).json({ error: { code: 'NO_FILES', message: 'No files provided' } });
  }

  const provider = new SupabaseProvider(storageClient);
  const uploaded: any[] = [];

  try {
    for (const file of files) {
      const name = file.originalname;
      const ext = name.includes('.') ? name.split('.').pop() : null;
      const mime = file.mimetype || 'application/octet-stream';
      const buffer = file.buffer;
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      const key = `folder_${id}/${Date.now()}_${name}`;

      // Upload to storage
      await provider.putObject({ key, contentType: mime, body: buffer });

      // Insert document record into database
      const result = await pool.query(
        `INSERT INTO dms.documents (folder_id, name, ext, mime_type, size_bytes, storage_key, checksum_sha256, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, folder_id, name, ext, mime_type, size_bytes, storage_key, checksum_sha256, version`,
        [Number(id), name, ext, mime, buffer.length, key, checksum, 1]
      );

      uploaded.push(result.rows[0]);
    }

    res.status(201).json({ folderId: Number(id), uploaded });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: { code: 'UPLOAD_ERROR', message: error.message } });
  }
});

// GET /documents/:id – metadata and signed URL
documentsRouter.get('/documents/:id', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  try {
    const result = await pool.query('SELECT * FROM dms.documents WHERE id = $1', [Number(id)]);
    const doc = result.rows[0];

    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const provider = new SupabaseProvider(storageClient);
    const signed_url = await provider.getSignedUrl({ key: doc.storage_key, expiresInSeconds: 3600 });

    res.json({ ...doc, signed_url });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  }
});

// GET /documents/:id/url – get signed URL only
documentsRouter.get('/documents/:id/url', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  try {
    const result = await pool.query('SELECT storage_key FROM dms.documents WHERE id = $1 AND deleted_at IS NULL', [Number(id)]);
    const doc = result.rows[0];

    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const provider = new SupabaseProvider(storageClient);
    const expiresInSeconds = 3600; // 1 hour
    const signed_url = await provider.getSignedUrl({ key: doc.storage_key, expiresInSeconds });

    // Calculate expiration timestamp
    const expires_at = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    res.json({ signed_url, expires_at });
  } catch (error: any) {
    console.error('Get URL error:', error);
    res.status(500).json({ error: { code: 'GET_URL_ERROR', message: error.message } });
  }
});

// GET /documents/:id/download – download file directly
documentsRouter.get('/documents/:id/download', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  try {
    const result = await pool.query('SELECT * FROM dms.documents WHERE id = $1 AND deleted_at IS NULL', [Number(id)]);
    const doc = result.rows[0];

    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const provider = new SupabaseProvider(storageClient);
    const { body, contentType } = await provider.getObject({ key: doc.storage_key });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', contentType || doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
    res.setHeader('Content-Length', body.length.toString());

    // Send file buffer
    res.send(body);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ error: { code: 'DOWNLOAD_ERROR', message: error.message } });
  }
});

// GET /documents/:id/content – get editable content for DOCX
documentsRouter.get('/documents/:id/content', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  if (!storageClient) {
    return res.status(500).json({ error: { code: 'NO_STORAGE', message: 'Supabase storage not initialized' } });
  }

  try {
    const doc = await getDocumentRecord(pool, Number(id));

    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const ext = (doc.ext || '').toLowerCase();
    if (!SUPPORTED_EDIT_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: { code: 'UNSUPPORTED_TYPE', message: `Editing not supported for .${ext || 'unknown'} files` } });
    }

    const provider = new SupabaseProvider(storageClient);
    const { body } = await provider.getObject({ key: doc.storage_key });

    let html: string | null = null;
    let conversionNote: string | null = null;
    let docxContent: DocxContent | null = null;

    if (ext === 'docx') {
      try {
        docxContent = parseDocxToBlocks(body);
      } catch (err: any) {
        console.error('DOCX parse error:', err);
        return res.status(500).json({
          error: {
            code: 'DOCX_PARSE_ERROR',
            message: 'Failed to parse DOCX content for editing.',
          },
        });
      }
    }

    res.json({
      id: doc.id,
      name: doc.name,
      ext: doc.ext,
      version: doc.version,
      html,
      conversionNote,
      docx: docxContent,
    });
  } catch (error: any) {
    console.error('Get content error:', error);
    res.status(500).json({ error: { code: 'GET_CONTENT_ERROR', message: error.message } });
  }
});

// POST /documents/:id/content – save edited content and create new version
documentsRouter.post('/documents/:id/content', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { docx, targetFormat } = req.body || {};
  const pool = (req as any).pg;
  const storageClient = (req as any).supabase;

  if (!storageClient) {
    return res.status(500).json({ error: { code: 'NO_STORAGE', message: 'Supabase storage not initialized' } });
  }

  if (!docx || typeof docx !== 'object' || !Array.isArray((docx as DocxContent).blocks)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_CONTENT',
        message: 'DOCX content is required and must include a blocks array',
      },
    });
  }

  try {
    const doc = await getDocumentRecord(pool, Number(id));

    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const currentExt = (doc.ext || '').toLowerCase();
    if (!SUPPORTED_EDIT_EXTENSIONS.includes(currentExt)) {
      return res.status(400).json({ error: { code: 'UNSUPPORTED_TYPE', message: `Editing not supported for .${currentExt || 'unknown'} files` } });
    }

    const format = ((targetFormat as string) || currentExt).toLowerCase();
    if (format !== 'docx' && format !== 'pdf') {
      return res.status(400).json({ error: { code: 'INVALID_FORMAT', message: 'targetFormat must be "docx" or "pdf"' } });
    }

    const provider = new SupabaseProvider(storageClient);
    const { body: originalBody } = await provider.getObject({ key: doc.storage_key });

    let newBuffer: Buffer;
    let mimeType: string;
    let newExt: string;

    if (format === 'docx') {
      try {
        newBuffer = applyBlocksToDocx(originalBody, docx as DocxContent);
      } catch (err: any) {
        console.error('DOCX apply error:', err);
        return res.status(500).json({
          error: {
            code: 'DOCX_APPLY_ERROR',
            message: 'Failed to apply edits to DOCX document.',
          },
        });
      }
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      newExt = 'docx';
    } else {
      const plainText = flattenDocxContentToText(docx as DocxContent);
      try {
        newBuffer = await createPdfFromText(plainText || '');
      } catch (err: any) {
        console.error('PDF conversion error:', err);
        return res.status(500).json({
          error: {
            code: 'PDF_CONVERT_ERROR',
            message: 'Failed to generate PDF from edited content.',
          },
        });
      }
      mimeType = 'application/pdf';
      newExt = 'pdf';
    }

    const checksum = crypto.createHash('sha256').update(newBuffer).digest('hex');
    const newVersion = (doc.version || 1) + 1;

    try {
      await pool.query('BEGIN');

      // Replace the existing file in storage at the same key so the document
      // stays in the same place in the system.
      try {
        const storageProvider = new SupabaseProvider(storageClient);
        // Delete old object (ignore errors if it does not exist)
        try {
          await storageProvider.deleteObject({ key: doc.storage_key });
        } catch (e) {
          console.warn('Delete existing object failed (continuing):', e);
        }
        // Upload new object at the same key
        await storageProvider.putObject({
          key: doc.storage_key,
          contentType: mimeType,
          body: newBuffer,
        });
      } catch (storageErr: any) {
        console.error('Storage replace error:', storageErr);
        await pool.query('ROLLBACK').catch(() => { });
        return res.status(500).json({
          error: {
            code: 'STORAGE_REPLACE_ERROR',
            message: storageErr.message || 'Failed to update document file in storage',
          },
        });
      }

      // Update main document record with new size/checksum/version/mime/ext
      const updateResult = await pool.query(
        `UPDATE dms.documents
        SET size_bytes = $1,
            checksum_sha256 = $2,
            version = $3,
            mime_type = $4,
            ext = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, folder_id, name, ext, mime_type, size_bytes, storage_key, checksum_sha256, version`,
        [newBuffer.length, checksum, newVersion, mimeType, newExt, doc.id]
      );

      await pool.query('COMMIT');

      const updated = updateResult.rows[0];
      res.json(updated);
    } catch (err: any) {
      await pool.query('ROLLBACK').catch(() => { });
      console.error('Save content error (transaction):', err);
      res.status(500).json({ error: { code: 'SAVE_CONTENT_ERROR', message: err.message } });
    }
  } catch (error: any) {
    if (!res.headersSent) {
      console.error('Save content error:', error);
      res.status(500).json({ error: { code: 'SAVE_CONTENT_ERROR', message: error.message } });
    }
  }
});

// PATCH /documents/:id – rename, tags, metadata
documentsRouter.patch('/documents/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, metadata } = req.body || {};
  const pool = (req as any).pg;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (metadata) {
      updates.push(`metadata_json = $${paramIndex++}`);
      values.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields to update' } });
    }

    values.push(Number(id));
    const query = `UPDATE dms.documents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  }
});

// POST /documents/:id/move – move document between folders
documentsRouter.post('/documents/:id/move', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { targetFolderId } = req.body || {};
  const pool = (req as any).pg;

  try {
    await pool.query(
      'UPDATE dms.documents SET folder_id = $1 WHERE id = $2',
      [Number(targetFolderId), Number(id)]
    );

    res.json({ id: Number(id), folder_id: Number(targetFolderId) });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  }
});

// DELETE /documents/:id – soft delete
documentsRouter.delete('/documents/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;

  try {
    await pool.query(
      'UPDATE dms.documents SET deleted_at = $1 WHERE id = $2',
      [new Date().toISOString(), Number(id)]
    );
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_DELETE_ERROR', message: error.message } });
  }
});

// GET /documents/:id/versions – list versions
documentsRouter.get('/documents/:id/versions', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;

  try {
    const result = await pool.query(
      'SELECT id, version, created_at FROM dms.documents WHERE id = $1',
      [Number(id)]
    );

    const versions = result.rows.map((d: any) => ({
      version: d.version,
      document_id: d.id,
      created_at: d.created_at
    }));

    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  }
});
