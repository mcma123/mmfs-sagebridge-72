import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authorize } from '../middleware/rbac';
import { validateCreateFolder, validateMoveFolder } from '../validation/schemas';

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const foldersRouter = Router();

// GET /companies/:companyId/tree – fetch tree or subtree
foldersRouter.get('/companies/:companyId/tree', authorize('Viewer'), async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const { folderId } = req.query as any;
  const db = (req as any).db;
  if (!db) return res.status(500).json({ error: { code: 'NO_DB', message: 'Supabase not initialized' } });
  let basePath: string | null = null;
  if (folderId) {
    const { data: f, error } = await db.from('dms.folders').select('path').eq('id', Number(folderId)).maybeSingle();
    if (error) return res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
    basePath = f?.path || null;
  }
  const query = db.from('dms.folders').select('id,parent_id,name,type,path,depth').eq('company_id', Number(companyId));
  const { data, error } = basePath ? await query.like('path', `${basePath}%`) : await query;
  if (error) return res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  res.json({ companyId: Number(companyId), folderId: folderId ? Number(folderId) : null, nodes: data || [] });
});

// GET /folders/:id – folder details + breadcrumb
foldersRouter.get('/folders/:id', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  const { data: folder, error } = await db.from('dms.folders').select('*').eq('id', Number(id)).maybeSingle();
  if (error) return res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  if (!folder) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Folder not found' } });
  const ids = (folder.path as string).split('/').filter(Boolean).map(Number);
  const { data: breadcrumb } = await db.from('dms.folders').select('id,name').in('id', ids);
  res.json({ ...folder, breadcrumb: (breadcrumb || []).sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id)) });
});

// GET /folders/:id/children – paginated list of folders/documents
foldersRouter.get('/folders/:id/children', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, pageSize = 50 } = req.query as any;
  const db = (req as any).db;
  const start = (Number(page) - 1) * Number(pageSize);
  const end = start + Number(pageSize) - 1;
  const { data: folders } = await db.from('dms.folders').select('id,name,type,slug,depth,path').eq('parent_id', Number(id)).range(start, end);
  const { data: documents } = await db.from('dms.documents').select('id,name,ext,mime_type,size_bytes,version').eq('folder_id', Number(id)).range(start, end);
  res.json({ folderId: Number(id), page: Number(page), pageSize: Number(pageSize), folders: folders || [], documents: documents || [] });
});

// POST /folders – create folder {parent_id, name, type}
foldersRouter.post('/folders', authorize('Editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateCreateFolder(req.body);
    const db = (req as any).db;
    const { data: parent, error: pErr } = await db.from('dms.folders').select('id,path,depth,company_id').eq('id', data.parent_id).maybeSingle();
    if (pErr) throw Object.assign(new Error(pErr.message), { status: 500, code: 'DB_ERROR' });
    if (!parent) throw { status: 400, code: 'PARENT_NOT_FOUND', message: 'Parent folder not found' };
    const folderSlug = slugify(data.name);
    const { data: inserted, error: iErr } = await db.from('dms.folders')
      .insert({ company_id: parent.company_id, parent_id: data.parent_id, name: data.name, slug: folderSlug, type: data.type, path: '', depth: parent.depth + 1, order_index: 0 })
      .select('id,company_id,parent_id,name,slug,type,path,depth,order_index')
      .maybeSingle();
    if (iErr) throw Object.assign(new Error(iErr.message), { status: 500, code: 'DB_INSERT_ERROR' });
    const newPath = `${parent.path}/${inserted!.id}`;
    const { error: uErr } = await db.from('dms.folders').update({ path: newPath, depth: parent.depth + 1 }).eq('id', inserted!.id);
    if (uErr) throw Object.assign(new Error(uErr.message), { status: 500, code: 'DB_UPDATE_ERROR' });
    res.status(201).json({ ...inserted, path: newPath, depth: parent.depth + 1 });
  } catch (err) { next(err); }
});

// PATCH /folders/:id – rename, update metadata
foldersRouter.patch('/folders/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, metadata } = req.body || {};
  const db = (req as any).db;
  const updates: any = {};
  if (name) { updates.name = name; updates.slug = slugify(name); }
  if (metadata) updates.metadata_json = metadata;
  const { data, error } = await db.from('dms.folders').update(updates).eq('id', Number(id)).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  res.json(data);
});

// POST /folders/:id/move – move folder to a new parent (updates path)
foldersRouter.post('/folders/:id/move', authorize('Editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newParentId } = validateMoveFolder(req.body);
    const db = (req as any).db;
    const folderId = Number(id);
    const { data: folder, error: fErr } = await db.from('dms.folders').select('id,path,depth,company_id').eq('id', folderId).maybeSingle();
    if (fErr || !folder) throw Object.assign(new Error(fErr?.message || 'Folder not found'), { status: 404, code: 'FOLDER_NOT_FOUND' });
    const { data: parent, error: pErr } = await db.from('dms.folders').select('id,path,depth').eq('id', newParentId).maybeSingle();
    if (pErr || !parent) throw Object.assign(new Error(pErr?.message || 'Parent not found'), { status: 400, code: 'PARENT_NOT_FOUND' });
    const newPath = `${parent.path}/${folder.id}`;
    // Update folder parent and path
    const { error: uErr } = await db.from('dms.folders').update({ parent_id: newParentId, path: newPath, depth: parent.depth + 1 }).eq('id', folderId);
    if (uErr) throw Object.assign(new Error(uErr.message), { status: 500, code: 'DB_UPDATE_ERROR' });
    // Cascade update descendants
    const oldPrefix = folder.path + '/';
    const newPrefix = newPath + '/';
    const { data: descendants } = await db.from('dms.folders').select('id,path').like('path', `${oldPrefix}%`);
    if (descendants && descendants.length) {
      for (const d of descendants) {
        const updatedPath = (d.path as string).replace(oldPrefix, newPrefix);
        await db.from('dms.folders').update({ path: updatedPath }).eq('id', d.id);
      }
    }
    res.json({ id: folderId, newParentId, path: newPath, depth: parent.depth + 1 });
  } catch (err) { next(err); }
});

// DELETE /folders/:id – soft delete; optional restore
foldersRouter.delete('/folders/:id', authorize('Admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = (req as any).db;
  await db.from('dms.folders').update({ deleted_at: new Date().toISOString() }).eq('id', Number(id));
  res.status(204).end();
});

// POST /folders/:id/template – apply a template (e.g., Treaty sections)
foldersRouter.post('/folders/:id/template', authorize('Editor'), async (req, res) => {
  res.json({ applied: true });
});