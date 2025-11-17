import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';
import crypto from 'crypto';
import { SupabaseProvider } from '../storage/providers/SupabaseProvider';
import upload from '../middleware/upload';

export const documentsRouter = Router();

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
