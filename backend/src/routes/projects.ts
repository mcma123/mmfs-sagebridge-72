import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';

type ProjectStatus = 'Draft' | 'Active' | 'Pending Approval' | 'In Progress' | 'Done' | 'Cancelled';

export const projectsRouter = Router();

function currencySymbol(cur: string) {
  switch (cur) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'ZAR': return 'R';
    default: return '';
  }
}

function formatValueDisplay(amount: number, currency: string) {
  const sym = currencySymbol(currency);
  const n = isFinite(amount) ? amount : 0;
  return `${sym}${new Intl.NumberFormat().format(n)}`;
}

function mapRowToProject(r: any) {
  return {
    id: r.id as string,
    country: r.country as string,
    client: r.client as string,
    name: r.name as string,
    type: r.type as string,
    coverage: r.coverage as string,
    value: formatValueDisplay(Number(r.value_amount || 0), String(r.currency || 'USD')),
    dueDate: r.due_date ? String(r.due_date) : '',
    status: r.status as ProjectStatus,
    progress: Number(r.progress || 0),
    latestNote: r.latest_note || undefined,
    lastUpdate: r.last_update || undefined,
    stage: r.stage || undefined,
    team: Array.isArray(r.team) ? r.team : r.team ?? [],
    daysInStage: r.days_in_stage ?? undefined,
    blockers: Array.isArray(r.blockers) ? r.blockers : r.blockers ?? [],
  };
}

// Seed data mirroring the UI's initialProjects (amounts chosen to match display)
const initialSeed = [
  {
    id: 'MZ-2025-FAC-002',
    country: '🇲🇿 Mozambique',
    client: 'Maamba Collieries Limited',
    name: 'Marine Cargo Insurance',
    type: 'Facultative',
    coverage: 'Marine Cargo',
    value_amount: 2500000,
    currency: 'USD',
    due_date: '2025-03-15',
    status: 'Active' as ProjectStatus,
    progress: 75,
  },
  {
    id: 'ZA-2025-TRT-001',
    country: '🇿🇦 South Africa',
    client: 'TransAxis Reinsurance',
    name: 'Property Treaty',
    type: 'Treaty',
    coverage: 'Property',
    value_amount: 5000000,
    currency: 'USD',
    due_date: '2025-04-20',
    status: 'In Progress' as ProjectStatus,
    progress: 45,
  },
  {
    id: 'ZM-2025-FAC-003',
    country: '🇿🇲 Zambia',
    client: 'Construction Corp',
    name: 'Construction All Risk',
    type: 'Facultative',
    coverage: 'Construction',
    value_amount: 3200000,
    currency: 'USD',
    due_date: '2025-02-28',
    status: 'Pending Approval' as ProjectStatus,
    progress: 60,
  },
];

// Helper to ensure pool exists
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

// GET /api/v1/dms/projects → list projects (auto-seed if empty)
projectsRouter.get('/', authorize('Viewer'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { rows } = await pool.query('SELECT * FROM dms.projects ORDER BY created_at DESC');
    if (!rows || rows.length === 0) {
      // Auto-seed on first run with minimal required columns
      const text = `
        INSERT INTO dms.projects (id, country, client, name, type, coverage, value_amount, currency, due_date, status, progress)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
               ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22),
               ($23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
      `;
      const v = initialSeed.flatMap((p) => [
        p.id, p.country, p.client, p.name, p.type, p.coverage, p.value_amount, p.currency, p.due_date, p.status, p.progress,
      ]);
      await pool.query(text, v);
      const seeded = await pool.query('SELECT * FROM dms.projects ORDER BY created_at DESC');
      return res.json(seeded.rows.map(mapRowToProject));
    }
    res.json(rows.map(mapRowToProject));
  } catch (e: any) {
    console.error('[dms.projects][GET] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_ERROR', message: e?.message || 'Unknown error' } });
  }
});

// POST /api/v1/dms/projects → create a project
projectsRouter.post('/', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const b = req.body || {};
    const id = String(b.id || '').trim();
    if (!id) return res.status(400).json({ error: { code: 'VALIDATION', message: 'id is required' } });

    const text = `
      INSERT INTO dms.projects
        (id, country, client, name, type, coverage, value_amount, currency, due_date, status, progress, team, blockers)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11::jsonb,$12::jsonb)
      RETURNING *
    `;
    const values = [
      id,
      String(b.country || '').trim(),
      String(b.clientName || '').trim(),
      String(b.projectName || '').trim(),
      String(b.projectType || '').trim(),
      String(b.coverage || '').trim(),
      Number(b.value || 0),
      String(b.currency || 'USD'),
      b.dueDate ? String(b.dueDate) : null,
      (b.status || 'Active') as ProjectStatus,
      JSON.stringify(Array.isArray(b.assignedTeam) ? b.assignedTeam : []),
      JSON.stringify([]),
    ];
    const { rows } = await pool.query(text, values);
    res.status(201).json(mapRowToProject(rows[0]));
  } catch (e: any) {
    console.error('[dms.projects][POST] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_INSERT_ERROR', message: e?.message || 'Unknown error' } });
  }
});

// PATCH /api/v1/dms/projects/:id/status → update status (apply rules)
projectsRouter.patch('/:id/status', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { status } = req.body || {};
    const next: any = { status: status as ProjectStatus };
    let progressAdj: number | null = null;
    if (status === 'Done') progressAdj = 100;
    if (status === 'Cancelled') progressAdj = 0;

    const text = `
      UPDATE dms.projects
      SET status = $2
          ${progressAdj !== null ? ', progress = $3' : ''}
      WHERE id = $1
      RETURNING *
    `;
    const params = progressAdj !== null ? [id, status, progressAdj] : [id, status];
    const { rows } = await pool.query(text, params);
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    res.json(mapRowToProject(rows[0]));
  } catch (e: any) {
    console.error('[dms.projects][PATCH status] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_UPDATE_ERROR', message: e?.message || 'Unknown error' } });
  }
});

// PATCH /api/v1/dms/projects/:id/progress → update progress (+ optional note)
projectsRouter.patch('/:id/progress', authorize('Editor'), async (req: Request, res: Response) => {
  const client = await (async () => {
    try { return getPool(req); } catch { return null; }
  })();
  if (!client) return res.status(500).json({ error: { code: 'NO_PG_POOL', message: 'Postgres pool not initialized' } });

  const pool = client;
  const { id } = req.params;
  const { progressPercent, note } = req.body || {};
  const clamped = Math.max(0, Math.min(100, Number(progressPercent || 0)));

  try {
    // Update project progress
    const upd = await pool.query(
      'UPDATE dms.projects SET progress = $2 WHERE id = $1 RETURNING *',
      [id, clamped]
    );
    if (!upd.rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

    // If note provided, insert note and update latest_note/last_update
    if (typeof note === 'string' && note.trim()) {
      const nowUpdate = await pool.query(
        'UPDATE dms.projects SET latest_note = $2, last_update = NOW() WHERE id = $1 RETURNING *',
        [id, note.trim()]
      );
      await pool.query(
        'INSERT INTO dms.project_notes(project_id, text) VALUES ($1, $2)',
        [id, note.trim()]
      );
      return res.json(mapRowToProject(nowUpdate.rows[0]));
    }

    res.json(mapRowToProject(upd.rows[0]));
  } catch (e: any) {
    console.error('[dms.projects][PATCH progress] error:', e);
    res.status(500).json({ error: { code: 'DB_UPDATE_ERROR', message: e?.message || 'Unknown error' } });
  }
});

// POST /api/v1/dms/projects/:id/notes → add a note
projectsRouter.post('/:id/notes', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { text, author } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: { code: 'VALIDATION', message: 'text is required' } });

    const noteIns = await pool.query(
      'INSERT INTO dms.project_notes(project_id, text, author) VALUES ($1, $2, $3) RETURNING *',
      [id, String(text).trim(), author ? String(author) : null]
    );

    const projUpd = await pool.query(
      'UPDATE dms.projects SET latest_note = $2, last_update = NOW() WHERE id = $1 RETURNING *',
      [id, String(text).trim()]
    );

    res.status(201).json({ project: mapRowToProject(projUpd.rows[0]), note: noteIns.rows[0] });
  } catch (e: any) {
    console.error('[dms.projects][POST note] error:', e);
    res.status(e?.status || 500).json({ error: { code: e?.code || 'DB_INSERT_ERROR', message: e?.message || 'Unknown error' } });
  }
});

/**
 * DELETE /api/v1/dms/projects/:id
 * Removes a project (project_notes are deleted via FK ON DELETE CASCADE)
 * Role: Editor+
 */
projectsRouter.delete('/:id', authorize('Editor'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const result = await pool.query('DELETE FROM dms.projects WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }
    res.status(204).end();
  } catch (e: any) {
    console.error('[dms.projects][DELETE] error:', e);
    res.status(500).json({ error: { code: 'DB_DELETE_ERROR', message: e?.message || 'Unknown error' } });
  }
});

export default projectsRouter;
