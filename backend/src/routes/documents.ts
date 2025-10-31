import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';
import crypto from 'crypto';
import { SupabaseProvider } from '../storage/providers/SupabaseProvider';

export const documentsRouter = Router();

// POST /folders/:id/upload – upload file(s)
documentsRouter.post('/folders/:id/upload', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  const storageClient = (req as any).supabase;
  if (!storageClient) return res.status(500).json({ error: { code: 'NO_STORAGE', message: 'Supabase storage not initialized' } });
  const provider = new SupabaseProvider(storageClient);
  const files: Array<{ name: string; contentBase64: string; mime_type?: string }> = (req.body?.files as Array<{ name: string; contentBase64: string; mime_type?: string }>) || [];
  const uploaded: any[] = [];
  for (const file of files) {
    const name = file.name;
    const ext = name.includes('.') ? name.split('.').pop() : null;
    const mime = file.mime_type || 'application/octet-stream';
    const base64 = file.contentBase64 || '';
    const buffer = Buffer.from(base64, 'base64');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const key = `folder_${id}/${Date.now()}_${name}`;
    await provider.putObject({ key, contentType: mime, body: buffer });
    const { data: inserted, error } = await db.from('dms.documents').insert({
      folder_id: Number(id), name, ext, mime_type: mime, size_bytes: buffer.length,
      storage_key: key, checksum_sha256: checksum, version: 1,
    }).select('id,folder_id,name,ext,mime_type,size_bytes,storage_key,checksum_sha256,version').maybeSingle();
    if (error) return res.status(500).json({ error: { code: 'DB_INSERT_ERROR', message: error.message } });
    uploaded.push(inserted);
  }
  res.status(201).json({ folderId: Number(id), uploaded });
});

// GET /documents/:id – metadata and signed URL
documentsRouter.get('/documents/:id', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  const storageClient = (req as any).supabase;
  const provider = new SupabaseProvider(storageClient);
  const { data: doc, error } = await db.from('dms.documents').select('*').eq('id', Number(id)).maybeSingle();
  if (error) return res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  const signed_url = await provider.getSignedUrl({ key: doc.storage_key, expiresInSeconds: 3600 });
  res.json({ ...doc, signed_url });
});

// PATCH /documents/:id – rename, tags, metadata
documentsRouter.patch('/documents/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, metadata } = req.body || {};
  const db = (req as any).db;
  const updates: any = {};
  if (name) updates.name = name;
  if (metadata) updates.metadata_json = metadata;
  const { data, error } = await db.from('dms.documents').update(updates).eq('id', Number(id)).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  res.json(data);
});

// POST /documents/:id/move – move document between folders
documentsRouter.post('/documents/:id/move', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { targetFolderId } = req.body || {};
  const db = (req as any).db;
  const { error } = await db.from('dms.documents').update({ folder_id: Number(targetFolderId) }).eq('id', Number(id));
  if (error) return res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  res.json({ id: Number(id), folder_id: Number(targetFolderId) });
});

// DELETE /documents/:id – soft delete
documentsRouter.delete('/documents/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  await db.from('dms.documents').update({ deleted_at: new Date().toISOString() }).eq('id', Number(id));
  res.status(204).end();
});

// GET /documents/:id/versions – list versions
documentsRouter.get('/documents/:id/versions', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  const { data } = await db.from('dms.documents').select('id,version,created_at').eq('id', Number(id));
  res.json((data || []).map((d: any) => ({ version: d.version, document_id: d.id, created_at: d.created_at })));
});