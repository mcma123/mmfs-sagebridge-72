import express from 'express';
import { authorize } from '../middleware/rbac';

const router = express.Router();

/**
 * Helper function to convert PostgreSQL NUMERIC types (returned as strings) to numbers
 * Handles null/undefined safely by returning 0
 */
const parseNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  return typeof value === 'string' ? parseFloat(value) : Number(value);
};

/**
 * GET /api/v1/dashboard/overview
 * Financial overview metrics for dashboard
 * Query params: startDate, endDate, entityIds (comma-separated)
 */
router.get('/overview', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    const { startDate, endDate, entityIds } = req.query;

    const params = [];
    params.push(startDate || null);
    params.push(endDate || null);
    params.push(entityIds ? `{${entityIds}}` : null);

    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_dashboard_financial_overview($1, $2, $3)',
      params
    );
    const rawData = result.rows[0] || {
      total_cash_flow: 0,
      accounts_receivable: 0,
      accounts_payable: 0,
      bank_balance: 0,
      total_cash_flow_change: 0,
      accounts_receivable_change: 0,
      accounts_payable_change: 0,
      bank_balance_change: 0
    };

    // Convert NUMERIC strings to numbers
    const data = {
      total_cash_flow: parseNumeric(rawData.total_cash_flow),
      accounts_receivable: parseNumeric(rawData.accounts_receivable),
      accounts_payable: parseNumeric(rawData.accounts_payable),
      bank_balance: parseNumeric(rawData.bank_balance),
      total_cash_flow_change: parseNumeric(rawData.total_cash_flow_change),
      accounts_receivable_change: parseNumeric(rawData.accounts_receivable_change),
      accounts_payable_change: parseNumeric(rawData.accounts_payable_change),
      bank_balance_change: parseNumeric(rawData.bank_balance_change)
    };

    res.json(data);
  } catch (err) {
    console.error('Error fetching dashboard overview:', err);
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/performance
 * Monthly performance chart data (income vs expenses)
 * Query params: months (default: 7), entityIds (comma-separated)
 */
router.get('/performance', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    const months = parseInt(req.query.months as string) || 7;
    const { entityIds } = req.query;

    const params = [];
    params.push(months);
    params.push(entityIds ? `{${entityIds}}` : null);

    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_dashboard_performance_chart($1, $2)',
      params
    );

    // Convert NUMERIC strings to numbers for each month
    const items = result.rows.map((row: any) => ({
      month_name: row.month_name,
      income: parseNumeric(row.income),
      expenses: parseNumeric(row.expenses)
    }));

    res.json({ items });
  } catch (err) {
    console.error('Error fetching dashboard performance:', err);
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/recent-transactions
 * Recent posted journal entries for activity feed
 * Query params: startDate, endDate, entityIds (comma-separated), limit
 */
router.get('/recent-transactions', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    const { startDate, endDate, entityIds, limit } = req.query;

    const params = [];
    params.push(startDate || null);
    params.push(endDate || null);
    params.push(entityIds ? `{${entityIds}}` : null);
    params.push(limit ? parseInt(limit as string) : 10);

    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_dashboard_recent_transactions($1, $2, $3, $4)',
      params
    );

    // Convert NUMERIC strings to numbers for each transaction
    const items = result.rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      reference: row.reference,
      amount: parseNumeric(row.amount),
      type: row.type,
      created_at: row.created_at
    }));

    res.json({ items });
  } catch (err) {
    console.error('Error fetching recent transactions:', err);
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/marine-kpis
 * Marine insurance specific KPIs
 * Query params: startDate, endDate, entityIds (comma-separated)
 */
router.get('/marine-kpis', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    const { startDate, endDate, entityIds } = req.query;

    const params = [];
    params.push(startDate || null);
    params.push(endDate || null);
    params.push(entityIds ? `{${entityIds}}` : null);

    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_dashboard_marine_kpis($1, $2, $3)',
      params
    );
    const rawData = result.rows[0] || {
      premium_receivables: 0,
      commission_payable: 0,
      unreconciled_count: 0,
      unreconciled_amount: 0,
      premium_income_mtd: 0,
      claims_ratio: 0,
      reinsurance_utilization: 0,
      premium_receivables_change: 0,
      commission_payable_change: 0,
      premium_income_change: 0,
      claims_ratio_change: 0,
      reinsurance_utilization_change: 0
    };

    // Convert NUMERIC strings to numbers
    const data = {
      premium_receivables: parseNumeric(rawData.premium_receivables),
      commission_payable: parseNumeric(rawData.commission_payable),
      unreconciled_count: parseNumeric(rawData.unreconciled_count),
      unreconciled_amount: parseNumeric(rawData.unreconciled_amount),
      premium_income_mtd: parseNumeric(rawData.premium_income_mtd),
      claims_ratio: parseNumeric(rawData.claims_ratio),
      reinsurance_utilization: parseNumeric(rawData.reinsurance_utilization),
      premium_receivables_change: parseNumeric(rawData.premium_receivables_change),
      commission_payable_change: parseNumeric(rawData.commission_payable_change),
      premium_income_change: parseNumeric(rawData.premium_income_change),
      claims_ratio_change: parseNumeric(rawData.claims_ratio_change),
      reinsurance_utilization_change: parseNumeric(rawData.reinsurance_utilization_change)
    };

    res.json(data);
  } catch (err) {
    console.error('Error fetching marine KPIs:', err);
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/upcoming-payments
 * Upcoming and overdue payment obligations
 * Query params: startDate, endDate, entityIds (comma-separated), limit
 */
router.get('/upcoming-payments', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    const { startDate, endDate, entityIds, limit } = req.query;

    const params = [];
    params.push(startDate || null);
    params.push(endDate || null);
    params.push(entityIds ? `{${entityIds}}` : null);
    params.push(limit ? parseInt(limit as string) : 10);

    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_dashboard_upcoming_payments($1, $2, $3, $4)',
      params
    );

    // Convert NUMERIC strings to numbers for each payment
    const items = result.rows.map((row: any) => ({
      id: row.id,
      due_date: row.due_date,
      entity_name: row.entity_name,
      description: row.description,
      amount: parseNumeric(row.amount),
      status: row.status,
      payment_status: row.payment_status
    }));

    res.json({ items });
  } catch (err) {
    console.error('Error fetching upcoming payments:', err);
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/reconciliation-summary
 * Payment reconciliation status summary
 * Returns count and total amount of unallocated bank transactions
 */
router.get('/reconciliation-summary', authorize(['admin', 'accountant', 'editor', 'viewer']), async (req: any, res: any, next: any) => {
  try {
    // Get unallocated bank transactions
    const result = await req.pg.query(`
      SELECT
        COUNT(*) as unallocated_count,
        COALESCE(SUM(amount), 0) as unallocated_amount
      FROM accounting.bank_transactions
      WHERE status = 'unallocated'
        AND deleted_at IS NULL
    `);

    // Get recent reconciliations (last 5)
    const recentResult = await req.pg.query(`
      SELECT
        bt.id,
        bt.transaction_date,
        bt.reference,
        bt.amount,
        bt.status,
        COUNT(pa.id) as allocation_count
      FROM accounting.bank_transactions bt
      LEFT JOIN accounting.payment_allocations pa ON bt.id = pa.bank_transaction_id
      WHERE bt.status IN ('matched', 'partially_matched')
        AND bt.deleted_at IS NULL
      GROUP BY bt.id, bt.transaction_date, bt.reference, bt.amount, bt.status
      ORDER BY bt.transaction_date DESC
      LIMIT 5
    `);

    const rawData = result.rows[0] || { unallocated_count: 0, unallocated_amount: 0 };

    const data = {
      unallocated_count: parseInt(rawData.unallocated_count) || 0,
      unallocated_amount: parseNumeric(rawData.unallocated_amount),
      recent_reconciliations: recentResult.rows.map((row: any) => ({
        id: row.id,
        transaction_date: row.transaction_date,
        reference: row.reference,
        amount: parseNumeric(row.amount),
        status: row.status,
        allocation_count: parseInt(row.allocation_count) || 0
      }))
    };

    res.json(data);
  } catch (err) {
    console.error('Error fetching reconciliation summary:', err);
    next(err);
  }
});

export default router;
