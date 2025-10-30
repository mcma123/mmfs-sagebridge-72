import { Router } from 'express';
import { authorize } from '../middleware/rbac';

export const documentsRouter = Router();

// POST /folders/:id/upload – upload file(s)
documentsRouter.post('/folders/:id/upload', authorize('Editor'), async (req, res) => {
  const { id } = req.params;
  // Placeholder: In real code, parse multipart/form-data and store via StorageProvider
  res.status(201).json({ folderId: Number(id), uploaded: [] });
});

// GET /documents/:id – metadata and signed URL
documentsRouter.get('/documents/:id', authorize('Viewer'), async (req, res) => {
  const { id } = req.params;
  res.json({ id: Number(id), signed_url: '/local/example?e=3600' });
});

// PATCH /documents/:id – rename, tags, metadata
documentsRouter.patch('/documents/:id', authorize('Editor'), async (req, res) => {
  const { id } = req.params;
  const { name, tags, metadata } = req.body || {};
  res.json({ id: Number(id), name, tags, metadata });
});

// POST /documents/:id/move – move document between folders
documentsRouter.post('/documents/:id/move', authorize('Editor'), async (req, res) => {
  const { id } = req.params;
  const { targetFolderId } = req.body || {};
  res.json({ id: Number(id), folder_id: Number(targetFolderId) });
});

// DELETE /documents/:id – soft delete
documentsRouter.delete('/documents/:id', authorize('Editor'), async (_req, res) => {
  res.status(204).end();
});

// GET /documents/:id/versions – list versions
documentsRouter.get('/documents/:id/versions', authorize('Viewer'), async (req, res) => {
  const { id } = req.params;
  res.json([{ version: 1, document_id: Number(id), created_at: new Date().toISOString() }]);
});