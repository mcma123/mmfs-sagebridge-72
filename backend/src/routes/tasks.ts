import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';

type TaskStatus = 'Open' | 'In Progress' | 'Blocked' | 'Done' | 'Cancelled';
type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export const tasksRouter = Router();

function mapRowToTask(r: any) {
  return {
    id: Number(r.id),
    projectId: r.project_id ? String(r.project_id) : null,
    title: String(r.title || ''),
    type: String(r.type || ''),
    assignee: String(r.assignee || ''),
    dueDate: r.due_date ? String(r.due_date) : '',
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    description: r.description || undefined,
    tags: Array.isArray(r.tags) ? r.tags : r.tags ?? [],
    estimatedHours: r.estimated_hours !== null && r.estimated_hours !== undefined ? Number(r.estimated_hours) : undefined,
    latestNote: r.latest_note || undefined,
    completedAt: r.completed_at || undefined,
    createdAt: r.created_at || undefined,
    updatedAt: r.updated_at || undefined,
  };
}

// Seed data mirroring existing mock UI examples (minimal columns)
const initialSeed = [
  // Use null project_id to avoid FK violations if projects have not been seeded yet.
  {
    project_id: null,
    title: 'Submit final placement slip to Munich Re',
    type: 'Send Communication',
    assignee: 'TK',
    due_date: '2025-01-18',
    priority: 'High' as TaskPriority,
    status: 'Open' as TaskStatus,
  },
  {
    project_id: null,
    title: 'Review and approve construction policy terms',
    type: 'Review & Approve',
    assignee: 'JD',
    due_date: '2025-01-22',
    priority: 'High' as TaskPriority,
    status: 'Open' as TaskStatus,
  },
  {
    project_id: null,
    title: 'Upload signed cover note to DMS',
    type: 'Upload Document',
    assignee: 'SM',
    due_date: '2025-01-22',
    priority: 'Medium' as TaskPriority,
    status: 'Open' as TaskStatus,
  },
  {
    project_id: null,
    title: 'Follow up with TransAxis on treaty renewal',
    type: 'Follow-up Action',
    assignee: 'TK',
    due_date: '2025-01-25',
    priority: 'Medium' as TaskPriority,
    status: 'Open' as TaskStatus,
  },
  {
    project_id: null,
    title: 'Process premium payment for Maamba project',
    type: 'Financial Task',
    assignee: 'AB',
    due_date: '2025-01-26',
    priority: 'High' as TaskPriority,
    status: 'Open' as TaskStatus,
  },
];

function getPool(req: Request) {
  const pool = (req as any).pg;
  if (!pool) {
    const err: any = new Error('Postgres pool not initialized');
    err.status = 500;
    err.code = 'NO_PG_POOL';
    throw err;
  }
  return pool;
}

/**
 * GET /api/v1/dms/tasks
 * Optional filters: status, assignee, projectId
 * Auto-seeds on first run if table empty
 */
tasksRouter.get('/', authorize('Viewer'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { status, assignee, projectId } = req.query as any;

    const clauses: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(String(status));
      clauses.push(`status = $${params.length}`);
    }
    if (assignee) {
      params.push(String(assignee));
      clauses.push(`assignee = $${params.length}`);
    }
    if (projectId) {
      params.push(String(projectId));
      clauses.push(`project_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM dms.tasks ${where} ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql, params);

    if (!rows || rows.length === 0) {
      // Auto-seed minimal example tasks
      const text = `
        INSERT INTO dms.tasks (project_id, title, type, assignee, due_date, priority, status)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7),
          ($8,$9,$10,$11,$12,$13,$14),
          ($15,$16,$17,$18,$19,$20,$21),
          ($22,$23,$24,$25,$26,$27,$28),
          ($29,$30,$31,$32,$33,$34,$35)
        RETURNING *
      `;
      const v = [
        initialSeed[0].project_id, initialSeed[0].title, initialSeed[0].type, initialSeed[0].assignee, initialSeed[0].due_date, initialSeed[0].priority, initialSeed[0].status,
        initialSeed[1].project_id, initialSeed[1].title, initialSeed[1].type, initialSeed[1].assignee, initialSeed[1].due_date, initialSeed[1].priority, initialSeed[1].status,
        initialSeed[2].project_id, initialSeed[2].title, initialSeed[2].type, initialSeed[2].assignee, initialSeed[2].due_date, initialSeed[2].priority, initialSeed[2].status,
        initialSeed[3].project_id, initialSeed[3].title, initialSeed[3].type, initialSeed[3].assignee, initialSeed[3].due_date, initialSeed[3].priority, initialSeed[3].status,
        initialSeed[4].project_id, initialSeed[4].title, initialSeed[4].type, initialSeed[4].assignee, initialSeed[4].due_date, initialSeed[4].priority, initialSeed[4].status,
      ];
      const seeded = await pool.query(text, v);
      return res.json(seeded.rows.map(mapRowToTask));
    }

    res.json(rows.map(mapRowToTask));
  } catch (e: any) {
    console.error('[dms.tasks][GET] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_ERROR', message: e?.message || 'Unknown error' } });
  }
});

/**
 * POST /api/v1/dms/tasks
 * Creates a task
 */
tasksRouter.post('/', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const b = req.body || {};

    const required = ['title', 'taskType', 'assignedTo', 'dueDate', 'priority'];
    const missing = required.filter((k) => !String(b[k] || '').trim());
    if (missing.length) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: `Missing required: ${missing.join(', ')}` } });
    }

    const text = `
      INSERT INTO dms.tasks
        (project_id, title, type, assignee, due_date, priority, status, description, tags, estimated_hours)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
      RETURNING *
    `;
    const values = [
      b.projectReference ? String(b.projectReference) : null,
      String(b.title || b.taskTitle).trim(),
      String(b.taskType).trim(),
      String(b.assignedTo).trim(),
      b.dueDate ? String(b.dueDate) : null,
      String(b.priority) as TaskPriority,
      (b.status || 'Open') as TaskStatus,
      b.description ? String(b.description) : null,
      JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
      b.estimatedHours != null ? Number(b.estimatedHours) : null,
    ];
    const { rows } = await pool.query(text, values);
    res.status(201).json(mapRowToTask(rows[0]));
  } catch (e: any) {
    console.error('[dms.tasks][POST] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_INSERT_ERROR', message: e?.message || 'Unknown error' } });
  }
});

/**
 * PATCH /api/v1/dms/tasks/:id/status
 * Updates task status; Done → set completed_at=NOW(), Cancelled → completed_at=NULL
 */
tasksRouter.patch('/:id/status', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: { code: 'VALIDATION', message: 'status is required' } });

    let sql = 'UPDATE dms.tasks SET status = $2';
    const params: any[] = [id, status];

    if (status === 'Done') {
      sql += ', completed_at = NOW()';
    } else if (status === 'Cancelled') {
      sql += ', completed_at = NULL';
    }
    sql += ' WHERE id = $1 RETURNING *';

    const { rows } = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    res.json(mapRowToTask(rows[0]));
  } catch (e: any) {
    console.error('[dms.tasks][PATCH status] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_UPDATE_ERROR', message: e?.message || 'Unknown error' } });
  }
});

/**
 * POST /api/v1/dms/tasks/:id/notes
 * Adds a note and updates latest_note/updated_at
 */
tasksRouter.post('/:id/notes', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { text, author } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: { code: 'VALIDATION', message: 'text is required' } });

    const noteIns = await pool.query(
      'INSERT INTO dms.task_notes(task_id, text, author) VALUES ($1, $2, $3) RETURNING *',
      [Number(id), String(text).trim(), author ? String(author) : null]
    );

    const taskUpd = await pool.query(
      'UPDATE dms.tasks SET latest_note = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [Number(id), String(text).trim()]
    );

    res.status(201).json({ task: mapRowToTask(taskUpd.rows[0]), note: noteIns.rows[0] });
  } catch (e: any) {
    console.error('[dms.tasks][POST note] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_INSERT_ERROR', message: e?.message || 'Unknown error' } });
  }
});

/**
 * DELETE /api/v1/dms/tasks/:id
 * Deletes a task (notes cascade)
 */
tasksRouter.delete('/:id', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const result = await pool.query('DELETE FROM dms.tasks WHERE id = $1', [Number(id)]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }
    res.status(204).end();
  } catch (e: any) {
    console.error('[dms.tasks][DELETE] error:', e);
    res.status(500).json({ error: { code: 'DB_DELETE_ERROR', message: e?.message || 'Unknown error' } });
  }
});

export default tasksRouter;