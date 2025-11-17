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
  const pool = (req as any).pg;
  if (!pool) return res.status(500).json({ error: { code: 'NO_DB', message: 'Database not initialized' } });

  try {
    let basePath: string | null = null;
    if (folderId) {
      const result = await pool.query('SELECT path FROM dms.folders WHERE id = $1', [Number(folderId)]);
      basePath = result.rows[0]?.path || null;
    }

    let query = 'SELECT id, parent_id, name, type, path, depth FROM dms.folders WHERE company_id = $1 AND deleted_at IS NULL';
    const params: any[] = [Number(companyId)];

    if (basePath) {
      query += ' AND path LIKE $2';
      params.push(`${basePath}%`);
    }

    const result = await pool.query(query, params);
    res.json({ companyId: Number(companyId), folderId: folderId ? Number(folderId) : null, nodes: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  }
});

// GET /folders/:id – folder details + breadcrumb
foldersRouter.get('/folders/:id', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;

  try {
    const folderResult = await pool.query('SELECT * FROM dms.folders WHERE id = $1', [Number(id)]);
    const folder = folderResult.rows[0];

    if (!folder) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Folder not found' } });
    }

    const ids = (folder.path as string).split('/').filter(Boolean).map(Number);

    let breadcrumb: any[] = [];
    if (ids.length > 0) {
      const breadcrumbResult = await pool.query(
        'SELECT id, name FROM dms.folders WHERE id = ANY($1)',
        [ids]
      );
      breadcrumb = breadcrumbResult.rows.sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }
    res.json({ folder, breadcrumb });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  }
});

// GET /folders/:id/children – paginated list of folders/documents
foldersRouter.get('/folders/:id/children', authorize('Viewer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, pageSize = 50 } = req.query as any;
  const pool = (req as any).pg;

  try {
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    const foldersResult = await pool.query(
      'SELECT id, name, type, slug, depth, path FROM dms.folders WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT $2 OFFSET $3',
      [Number(id), limit, offset]
    );

    // Only return non-deleted documents in children listing
    const documentsResult = await pool.query(
      'SELECT id, name, ext, mime_type, size_bytes, version FROM dms.documents WHERE folder_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT $2 OFFSET $3',
      [Number(id), limit, offset]
    );

    res.json({
      folderId: Number(id),
      page: Number(page),
      pageSize: Number(pageSize),
      folders: foldersResult.rows,
      documents: documentsResult.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
  }
});

// POST /folders/batch – create multiple folders recursively
foldersRouter.post('/folders/batch', authorize('Editor'), async (req: Request, res: Response) => {
  const { rootFolderId, folderPaths } = req.body;
  const pool = (req as any).pg;

  if (!rootFolderId || !Array.isArray(folderPaths)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'rootFolderId and folderPaths array required' } });
  }

  try {
    const createdFolders: any[] = [];
    const folderMap = new Map<string, number>(); // path -> folder id
    folderMap.set('', rootFolderId); // root

    // Get root folder details
    const rootResult = await pool.query(
      'SELECT id, path, depth, company_id FROM dms.folders WHERE id = $1',
      [rootFolderId]
    );

    if (rootResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'ROOT_NOT_FOUND', message: 'Root folder not found' } });
    }

    const root = rootResult.rows[0];

    // Sort paths by depth to create parent folders first
    const sortedPaths = folderPaths.sort((a: string, b: string) => {
      return a.split('/').length - b.split('/').length;
    });

    for (const folderPath of sortedPaths) {
      const segments = folderPath.split('/').filter(Boolean);
      let currentPath = '';

      for (let i = 0; i < segments.length; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i];

        // Skip if already created
        if (folderMap.has(currentPath)) continue;

        const parentId = folderMap.get(parentPath) || rootFolderId;

        // Get parent details
        const parentResult = await pool.query(
          'SELECT id, path, depth, company_id FROM dms.folders WHERE id = $1',
          [parentId]
        );

        if (parentResult.rows.length === 0) continue;

        const parent = parentResult.rows[0];
        const folderName = segments[i];
        const folderSlug = slugify(folderName);

        // Check if folder already exists
        const existingResult = await pool.query(
          'SELECT id FROM dms.folders WHERE parent_id = $1 AND name = $2',
          [parentId, folderName]
        );

        if (existingResult.rows.length > 0) {
          folderMap.set(currentPath, existingResult.rows[0].id);
          continue;
        }

        // Create folder
        const insertResult = await pool.query(
          `INSERT INTO dms.folders (company_id, parent_id, name, slug, type, path, depth, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, company_id, parent_id, name, slug, type, path, depth, order_index`,
          [parent.company_id, parentId, folderName, folderSlug, 'generic', '', parent.depth + 1, 0]
        );

        const inserted = insertResult.rows[0];
        const newPath = `${parent.path}/${inserted.id}`;

        // Update path
        await pool.query(
          'UPDATE dms.folders SET path = $1 WHERE id = $2',
          [newPath, inserted.id]
        );

        folderMap.set(currentPath, inserted.id);
        createdFolders.push({ ...inserted, path: newPath, relativePath: currentPath });
      }
    }

    res.status(201).json({ created: createdFolders, folderMap: Object.fromEntries(folderMap) });
  } catch (error: any) {
    console.error('Batch folder creation error:', error);
    res.status(500).json({ error: { code: 'BATCH_CREATE_ERROR', message: error.message } });
  }
});

// POST /folders – create folder {parent_id, name, type}
foldersRouter.post('/folders', authorize('Editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateCreateFolder(req.body);
    const pool = (req as any).pg;

    // Get parent folder details
    const parentResult = await pool.query(
      'SELECT id, path, depth, company_id FROM dms.folders WHERE id = $1',
      [data.parent_id]
    );

    if (parentResult.rows.length === 0) {
      return res.status(400).json({
        error: { code: 'PARENT_NOT_FOUND', message: 'Parent folder not found' }
      });
    }

    const parent = parentResult.rows[0];
    const folderSlug = slugify(data.name);

    // Insert new folder with temporary path
    const insertResult = await pool.query(
      `INSERT INTO dms.folders (company_id, parent_id, name, slug, type, path, depth, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, company_id, parent_id, name, slug, type, path, depth, order_index`,
      [parent.company_id, data.parent_id, data.name, folderSlug, data.type, '', parent.depth + 1, 0]
    );

    const inserted = insertResult.rows[0];
    const newPath = `${parent.path}/${inserted.id}`;

    // Update the path
    await pool.query(
      'UPDATE dms.folders SET path = $1, depth = $2 WHERE id = $3',
      [newPath, parent.depth + 1, inserted.id]
    );

    res.status(201).json({ ...inserted, path: newPath, depth: parent.depth + 1 });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
    } else {
      next(err);
    }
  }
});

// PATCH /folders/:id – rename, update metadata
foldersRouter.patch('/folders/:id', authorize('Editor'), async (req: Request, res: Response) => {
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
      updates.push(`slug = $${paramIndex++}`);
      values.push(slugify(name));
    }

    if (metadata) {
      updates.push(`metadata_json = $${paramIndex++}`);
      values.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields to update' } });
    }

    values.push(Number(id));
    const query = `UPDATE dms.folders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Folder not found' } });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: error.message } });
  }
});

// POST /folders/:id/move – move folder to a new parent (updates path)
foldersRouter.post('/folders/:id/move', authorize('Editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newParentId } = validateMoveFolder(req.body);
    const pool = (req as any).pg;
    const folderId = Number(id);

    // Get current folder details
    const folderResult = await pool.query(
      'SELECT id, path, depth, company_id FROM dms.folders WHERE id = $1',
      [folderId]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' }
      });
    }

    const folder = folderResult.rows[0];

    // Get new parent folder details
    const parentResult = await pool.query(
      'SELECT id, path, depth FROM dms.folders WHERE id = $1',
      [newParentId]
    );

    if (parentResult.rows.length === 0) {
      return res.status(400).json({
        error: { code: 'PARENT_NOT_FOUND', message: 'Parent not found' }
      });
    }

    const parent = parentResult.rows[0];
    const newPath = `${parent.path}/${folder.id}`;

    // Update folder parent and path
    await pool.query(
      'UPDATE dms.folders SET parent_id = $1, path = $2, depth = $3 WHERE id = $4',
      [newParentId, newPath, parent.depth + 1, folderId]
    );

    // Cascade update descendants
    const oldPrefix = folder.path + '/';
    const newPrefix = newPath + '/';

    const descendantsResult = await pool.query(
      'SELECT id, path FROM dms.folders WHERE path LIKE $1',
      [`${oldPrefix}%`]
    );

    if (descendantsResult.rows.length > 0) {
      for (const d of descendantsResult.rows) {
        const updatedPath = (d.path as string).replace(oldPrefix, newPrefix);
        await pool.query(
          'UPDATE dms.folders SET path = $1 WHERE id = $2',
          [updatedPath, d.id]
        );
      }
    }

    res.json({ id: folderId, newParentId, path: newPath, depth: parent.depth + 1 });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
    } else {
      next(err);
    }
  }
});

// DELETE /folders/:id – soft delete; optional restore
foldersRouter.delete('/folders/:id', authorize('Editor'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = (req as any).pg;

  try {
    await pool.query(
      'UPDATE dms.folders SET deleted_at = $1 WHERE id = $2',
      [new Date().toISOString(), Number(id)]
    );
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_DELETE_ERROR', message: error.message } });
  }
});

// POST /folders/:id/template – apply a template (e.g., Treaty sections)
foldersRouter.post('/folders/:id/template', authorize('Editor'), async (req, res) => {
  res.json({ applied: true });
});
