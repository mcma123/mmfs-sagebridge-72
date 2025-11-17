import { Router } from 'express';
import type { Request, Response } from 'express';
import { authorize } from '../middleware/rbac';

export const dmsDashboardRouter = Router();

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
 * GET /api/v1/dms/dashboard/summary
 * DMS overview metrics for the DMS dashboard
 *
 * - totalDocuments: count of active (non-deleted) documents in dms.documents
 * - teamMembers: count of active auth users (auth.users where status = 'active')
 */
dmsDashboardRouter.get('/summary', authorize('Viewer'), async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);

    // Total active documents (respect soft delete)
    const docResult = await pool.query('SELECT COUNT(*) AS count FROM dms.documents WHERE deleted_at IS NULL');
    const totalDocuments = parseInt(docResult.rows[0]?.count ?? '0', 10) || 0;

    // Team members = active auth users
    const teamResult = await pool.query("SELECT COUNT(*) AS count FROM auth.users WHERE status = 'active'");
    const teamMembers = parseInt(teamResult.rows[0]?.count ?? '0', 10) || 0;

    res.json({ totalDocuments, teamMembers });
  } catch (e: any) {
    console.error('[dms.dashboard][GET /summary] error:', e);
    res.status(e?.status || 500).json({
      error: {
        code: e?.code || 'DB_ERROR',
        message: e?.message || 'Failed to load DMS dashboard summary',
      },
    });
  }
});

export default dmsDashboardRouter;