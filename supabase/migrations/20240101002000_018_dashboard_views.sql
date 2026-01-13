-- Dashboard Views and Functions Migration
-- Provides aggregated data for dashboard components

-- =====================================================
-- 1. Financial Overview Metrics View
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_financial_overview CASCADE;
CREATE OR REPLACE VIEW accounting.v_dashboard_financial_overview AS
SELECT
  -- Cash Flow (sum of all cash and bank account balances)
  COALESCE(SUM(CASE
    WHEN a.type = 'Asset' AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
    THEN (le.debit - le.credit)
    ELSE 0
  END), 0) AS total_cash_flow,

  -- Accounts Receivable (sum of receivable account balances)
  COALESCE(SUM(CASE
    WHEN a.type = 'Asset' AND a.name ILIKE '%receivable%'
    THEN (le.debit - le.credit)
    ELSE 0
  END), 0) AS accounts_receivable,

  -- Accounts Payable (sum of payable account balances - as positive number)
  COALESCE(ABS(SUM(CASE
    WHEN a.type = 'Liability' AND a.name ILIKE '%payable%'
    THEN (le.credit - le.debit)
    ELSE 0
  END)), 0) AS accounts_payable,

  -- Bank Balance (sum of bank account balances only)
  COALESCE(SUM(CASE
    WHEN a.type = 'Asset' AND a.name ILIKE '%bank%'
    THEN (le.debit - le.credit)
    ELSE 0
  END), 0) AS bank_balance
FROM accounting.accounts a
LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
WHERE a.is_active = TRUE;

-- =====================================================
-- 2. Performance Chart Function (Monthly Income vs Expenses)
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_performance_chart(
  p_months INT DEFAULT 7
)
RETURNS TABLE (
  month_name TEXT,
  income NUMERIC,
  expenses NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH month_series AS (
    SELECT generate_series(
      DATE_TRUNC('month', CURRENT_DATE - ((p_months - 1) || ' months')::interval),
      DATE_TRUNC('month', CURRENT_DATE),
      '1 month'::interval
    ) AS month_date
  ),
  monthly_data AS (
    SELECT
      DATE_TRUNC('month', le.date) AS month_date,
      SUM(CASE WHEN a.type = 'Income' THEN le.credit - le.debit ELSE 0 END) AS income_amount,
      SUM(CASE WHEN a.type = 'Expense' THEN le.debit - le.credit ELSE 0 END) AS expenses_amount
    FROM accounting.ledger_entries le
    JOIN accounting.accounts a ON a.id = le.account_id
    WHERE le.date >= DATE_TRUNC('month', CURRENT_DATE - ((p_months - 1) || ' months')::interval)
    GROUP BY DATE_TRUNC('month', le.date)
  )
  SELECT
    TO_CHAR(ms.month_date, 'Mon') AS month_name,
    COALESCE(md.income_amount, 0) AS income,
    COALESCE(md.expenses_amount, 0) AS expenses
  FROM month_series ms
  LEFT JOIN monthly_data md ON ms.month_date = md.month_date
  ORDER BY ms.month_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. Recent Transactions View (Last 10 posted journals)
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_recent_transactions CASCADE;
CREATE OR REPLACE VIEW accounting.v_dashboard_recent_transactions AS
SELECT
  j.id,
  j.date,
  j.description,
  j.reference,
  COALESCE(ABS(SUM(jl.debit - jl.credit)), 0) AS amount,
  CASE
    WHEN SUM(jl.debit) > SUM(jl.credit) THEN 'expense'
    ELSE 'income'
  END AS type,
  j.created_at
FROM accounting.journals j
JOIN accounting.journal_lines jl ON jl.journal_id = j.id
WHERE j.status = 'posted'
GROUP BY j.id, j.date, j.description, j.reference, j.created_at
ORDER BY j.date DESC, j.created_at DESC
LIMIT 10;

-- =====================================================
-- 4. Marine Insurance KPIs View
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_marine_kpis CASCADE;
CREATE OR REPLACE VIEW accounting.v_dashboard_marine_kpis AS
SELECT
  -- Premium Receivables (sum of premium receivable account balances)
  (SELECT COALESCE(SUM(le.debit - le.credit), 0)
   FROM accounting.ledger_entries le
   JOIN accounting.accounts a ON a.id = le.account_id
   WHERE a.type = 'Asset' AND a.name ILIKE '%premium%receivable%'
  ) AS premium_receivables,

  -- Commission Payable (sum of commission payable account balances)
  (SELECT COALESCE(ABS(SUM(le.credit - le.debit)), 0)
   FROM accounting.ledger_entries le
   JOIN accounting.accounts a ON a.id = le.account_id
   WHERE a.type = 'Liability' AND a.name ILIKE '%commission%payable%'
  ) AS commission_payable,

  -- Unreconciled Payments (count and sum of draft journals)
  (SELECT COUNT(*)
   FROM accounting.journals
   WHERE status IN ('draft', 'reviewed')) AS unreconciled_count,

  (SELECT COALESCE(SUM(ABS(jl.debit - jl.credit)), 0)
   FROM accounting.journals j
   JOIN accounting.journal_lines jl ON jl.journal_id = j.id
   WHERE j.status IN ('draft', 'reviewed')) AS unreconciled_amount,

  -- Premium Income (Month-to-Date)
  (SELECT COALESCE(SUM(le.credit - le.debit), 0)
   FROM accounting.ledger_entries le
   JOIN accounting.accounts a ON a.id = le.account_id
   WHERE a.type = 'Income'
     AND a.name ILIKE '%premium%'
     AND DATE_TRUNC('month', le.date) = DATE_TRUNC('month', CURRENT_DATE)) AS premium_income_mtd,

  -- Claims Ratio (claims / premium income) for current year
  (SELECT
     CASE
       WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
       THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%claim%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
             COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
       ELSE 0
     END
   FROM accounting.ledger_entries le
   JOIN accounting.accounts a ON a.id = le.account_id
   WHERE DATE_TRUNC('year', le.date) = DATE_TRUNC('year', CURRENT_DATE)
     AND (a.name ILIKE '%premium%' OR a.name ILIKE '%claim%')
  ) AS claims_ratio,

  -- Reinsurance Utilization (reinsurance ceded / gross premium)
  (SELECT
     CASE
       WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
       THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%reinsurance%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
             COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
       ELSE 0
     END
   FROM accounting.ledger_entries le
   JOIN accounting.accounts a ON a.id = le.account_id
   WHERE DATE_TRUNC('year', le.date) = DATE_TRUNC('year', CURRENT_DATE)
     AND (a.name ILIKE '%gross%premium%' OR a.name ILIKE '%reinsurance%')
  ) AS reinsurance_utilization;

-- =====================================================
-- 5. Upcoming Payments View (Draft and Reviewed Payables)
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_upcoming_payments CASCADE;
CREATE OR REPLACE VIEW accounting.v_dashboard_upcoming_payments AS
SELECT
  j.id,
  j.date AS due_date,
  e.name AS entity_name,
  j.description,
  COALESCE(ABS(SUM(jl.credit - jl.debit)), 0) AS amount,
  j.status,
  CASE
    WHEN j.date < CURRENT_DATE THEN 'overdue'
    WHEN j.date = CURRENT_DATE THEN 'due_today'
    ELSE 'upcoming'
  END AS payment_status
FROM accounting.journals j
JOIN accounting.journal_lines jl ON jl.journal_id = j.id
JOIN accounting.accounts a ON a.id = jl.account_id
LEFT JOIN accounting.entities e ON e.id = jl.entity_id
WHERE j.status IN ('draft', 'reviewed')
  AND a.type = 'Liability'
  AND (jl.credit - jl.debit) > 0
GROUP BY j.id, j.date, e.name, j.description, j.status
ORDER BY j.date ASC
LIMIT 10;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT ON accounting.v_dashboard_financial_overview TO authenticated;
GRANT SELECT ON accounting.v_dashboard_recent_transactions TO authenticated;
GRANT SELECT ON accounting.v_dashboard_marine_kpis TO authenticated;
GRANT SELECT ON accounting.v_dashboard_upcoming_payments TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_performance_chart(INT) TO authenticated;

-- Add helpful comments
COMMENT ON VIEW accounting.v_dashboard_financial_overview IS 'Dashboard financial overview metrics: cash flow, receivables, payables, bank balance';
COMMENT ON VIEW accounting.v_dashboard_recent_transactions IS 'Last 10 posted journal entries for dashboard recent activity';
COMMENT ON VIEW accounting.v_dashboard_marine_kpis IS 'Marine insurance specific KPIs: premium receivables, commissions, claims ratio, reinsurance utilization';
COMMENT ON VIEW accounting.v_dashboard_upcoming_payments IS 'Upcoming and overdue payment obligations from draft/reviewed journals';
COMMENT ON FUNCTION accounting.fn_dashboard_performance_chart(INT) IS 'Monthly income vs expenses chart data for specified number of months';
