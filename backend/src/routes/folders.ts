import { Router } from 'express';
import { authorize } from '../middleware/rbac';
import { validateCreateFolder, validateMoveFolder } from '../validation/schemas';

export const foldersRouter = Router();

// GET /companies/:companyId/tree – fetch tree or subtree
foldersRouter.get('/companies/:companyId/tree', authorize('Viewer'), async (req, res) => {
  const { companyId } = req.params;
  const { folderId } = req.query;
  // Placeholder response
  res.json({ companyId: Number(companyId), folderId: folderId ? Number(folderId) : null, nodes: [] });
});

// GET /folders/:id – folder details + breadcrumb
foldersRouter.get('/folders/:id', authorize('Viewer'), async (req, res) => {
  const { id } = req.params;
  res.json({ id: Number(id), breadcrumb: [] });
});

// GET /folders/:id/children – paginated list of folders/documents
foldersRouter.get('/folders/:id/children', authorize('Viewer'), async (req, res) => {
  const { id } = req.params;
  const { page = 1, pageSize = 50 } = req.query as any;
  res.json({ folderId: Number(id), page: Number(page), pageSize: Number(pageSize), folders: [], documents: [] });
});

// POST /folders – create folder {parent_id, name, type}
foldersRouter.post('/folders', authorize('Editor'), async (req, res, next) => {
  try {
    const data = validateCreateFolder(req.body);
    // Placeholder create logic
    res.status(201).json({ id: 1, ...data, path: '/1/2/3', depth: 2 });
  } catch (err) { next(err); }
});

// PATCH /folders/:id – rename, update metadata
foldersRouter.patch('/folders/:id', authorize('Editor'), async (req, res) => {
  const { id } = req.params;
  const { name, metadata } = req.body || {};
  res.json({ id: Number(id), name, metadata });
});

// POST /folders/:id/move – move folder to a new parent (updates path)
foldersRouter.post('/folders/:id/move', authorize('Editor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newParentId } = validateMoveFolder(req.body);
    res.json({ id: Number(id), newParentId, path: '/moved/path', depth: 3 });
  } catch (err) { next(err); }
});

// DELETE /folders/:id – soft delete; optional restore
foldersRouter.delete('/folders/:id', authorize('Admin'), async (req, res) => {
  res.status(204).end();
});

// POST /folders/:id/template – apply a template (e.g., Treaty sections)
foldersRouter.post('/folders/:id/template', authorize('Editor'), async (req, res) => {
  res.json({ applied: true });
});