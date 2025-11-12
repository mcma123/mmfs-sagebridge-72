-- Dashboard Filtering Migration
-- Converts dashboard views to parameterized functions supporting date ranges and entity filters

-- Drop existing views first
DROP VIEW IF EXISTS accounting.v_dashboard_financial_overview CASCADE;
DROP VIEW IF EXISTS accounting.v_dashboard_marine_kpis CASCADE;
DROP VIEW IF EXISTS accounting.v_dashboard_recent_transactions CASCADE;
DROP VIEW IF EXISTS accounting.v_dashboard_upcoming_payments CASCADE;
DROP VIEW IF EXISTS accounting.v_dashboard_performance_chart CASCADE;

-- Drop existing functions if they exist (specify full signatures to handle overloaded versions)
DROP FUNCTION IF EXISTS accounting.fn_dashboard_financial_overview() CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_financial_overview(DATE, DATE, BIGINT[]) CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_performance_chart(INT) CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_performance_chart(INT, BIGINT[]) CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_recent_transactions() CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_recent_transactions(DATE, DATE, BIGINT[], INT) CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_marine_kpis() CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_marine_kpis(DATE, DATE, BIGINT[]) CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_upcoming_payments() CASCADE;
DROP FUNCTION IF EXISTS accounting.fn_dashboard_upcoming_payments(DATE, DATE, BIGINT[], INT) CASCADE;

-- =====================================================
-- 1. Financial Overview Function with Filters
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_financial_overview(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_entity_ids BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  total_cash_flow NUMERIC,
  accounts_receivable NUMERIC,
  accounts_payable NUMERIC,
  bank_balance NUMERIC,
  total_cash_flow_change NUMERIC,
  accounts_receivable_change NUMERIC,
  accounts_payable_change NUMERIC,
  bank_balance_change NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_prev_start_date DATE;
  v_prev_end_date DATE;
BEGIN
  -- Default to current month if no dates provided
  v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  -- Calculate previous period (same length as current period)
  v_prev_end_date := v_start_date - INTERVAL '1 day';
  v_prev_start_date := v_prev_end_date - (v_end_date - v_start_date);

  RETURN QUERY
  WITH current_period AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS total_cash_flow_cur,

      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND a.name ILIKE '%receivable%'
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS accounts_receivable_cur,

      COALESCE(ABS(SUM(CASE
        WHEN a.type = 'Liability' AND a.name ILIKE '%payable%'
        THEN (le.credit - le.debit)
        ELSE 0
      END)), 0) AS accounts_payable_cur,

      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND a.name ILIKE '%bank%'
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS bank_balance_cur
    FROM accounting.accounts a
    LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
      AND le.date >= v_start_date
      AND le.date <= v_end_date
    LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
    WHERE a.is_active = TRUE
      AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
  ),
  previous_period AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS total_cash_flow_prev,

      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND a.name ILIKE '%receivable%'
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS accounts_receivable_prev,

      COALESCE(ABS(SUM(CASE
        WHEN a.type = 'Liability' AND a.name ILIKE '%payable%'
        THEN (le.credit - le.debit)
        ELSE 0
      END)), 0) AS accounts_payable_prev,

      COALESCE(SUM(CASE
        WHEN a.type = 'Asset' AND a.name ILIKE '%bank%'
        THEN (le.debit - le.credit)
        ELSE 0
      END), 0) AS bank_balance_prev
    FROM accounting.accounts a
    LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
      AND le.date >= v_prev_start_date
      AND le.date <= v_prev_end_date
    LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
    WHERE a.is_active = TRUE
      AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
  )
  SELECT
    cp.total_cash_flow_cur,
    cp.accounts_receivable_cur,
    cp.accounts_payable_cur,
    cp.bank_balance_cur,

    -- Calculate percentage changes
    CASE
      WHEN pp.total_cash_flow_prev = 0 THEN 0
      ELSE ROUND(((cp.total_cash_flow_cur - pp.total_cash_flow_prev) / ABS(pp.total_cash_flow_prev) * 100)::numeric, 1)
    END,

    CASE
      WHEN pp.accounts_receivable_prev = 0 THEN 0
      ELSE ROUND(((cp.accounts_receivable_cur - pp.accounts_receivable_prev) / ABS(pp.accounts_receivable_prev) * 100)::numeric, 1)
    END,

    CASE
      WHEN pp.accounts_payable_prev = 0 THEN 0
      ELSE ROUND(((cp.accounts_payable_cur - pp.accounts_payable_prev) / ABS(pp.accounts_payable_prev) * 100)::numeric, 1)
    END,

    CASE
      WHEN pp.bank_balance_prev = 0 THEN 0
      ELSE ROUND(((cp.bank_balance_cur - pp.bank_balance_prev) / ABS(pp.bank_balance_prev) * 100)::numeric, 1)
    END
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. Performance Chart Function with Filters
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_performance_chart(
  p_months INT DEFAULT 7,
  p_entity_ids BIGINT[] DEFAULT NULL
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
    LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
    WHERE le.date >= DATE_TRUNC('month', CURRENT_DATE - ((p_months - 1) || ' months')::interval)
      AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
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
-- 3. Recent Transactions Function with Filters
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_recent_transactions(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_entity_ids BIGINT[] DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  date DATE,
  description TEXT,
  reference TEXT,
  amount NUMERIC,
  type TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  RETURN QUERY
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
    AND j.date >= v_start_date
    AND j.date <= v_end_date
    AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
  GROUP BY j.id, j.date, j.description, j.reference, j.created_at
  ORDER BY j.date DESC, j.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Marine KPIs Function with Filters
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_marine_kpis(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_entity_ids BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  premium_receivables NUMERIC,
  commission_payable NUMERIC,
  unreconciled_count BIGINT,
  unreconciled_amount NUMERIC,
  premium_income_mtd NUMERIC,
  claims_ratio NUMERIC,
  reinsurance_utilization NUMERIC,
  premium_receivables_change NUMERIC,
  commission_payable_change NUMERIC,
  premium_income_change NUMERIC,
  claims_ratio_change NUMERIC,
  reinsurance_utilization_change NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_prev_start_date DATE;
  v_prev_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  v_prev_end_date := v_start_date - INTERVAL '1 day';
  v_prev_start_date := v_prev_end_date - (v_end_date - v_start_date);

  RETURN QUERY
  WITH current_period AS (
    SELECT
      (SELECT COALESCE(SUM(le.debit - le.credit), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Asset' AND a.name ILIKE '%premium%receivable%'
         AND le.date >= v_start_date AND le.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS premium_receivables_cur,

      (SELECT COALESCE(ABS(SUM(le.credit - le.debit)), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Liability' AND a.name ILIKE '%commission%payable%'
         AND le.date >= v_start_date AND le.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS commission_payable_cur,

      (SELECT COUNT(*)
       FROM accounting.journals j
       JOIN accounting.journal_lines jl ON jl.journal_id = j.id
       WHERE j.status IN ('draft', 'reviewed')
         AND j.date >= v_start_date AND j.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS unreconciled_count_cur,

      (SELECT COALESCE(SUM(ABS(jl.debit - jl.credit)), 0)
       FROM accounting.journals j
       JOIN accounting.journal_lines jl ON jl.journal_id = j.id
       WHERE j.status IN ('draft', 'reviewed')
         AND j.date >= v_start_date AND j.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS unreconciled_amount_cur,

      (SELECT COALESCE(SUM(le.credit - le.debit), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Income' AND a.name ILIKE '%premium%'
         AND le.date >= v_start_date AND le.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS premium_income_cur,

      (SELECT
         CASE
           WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
           THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%claim%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
                 COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
           ELSE 0
         END
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE (a.name ILIKE '%premium%' OR a.name ILIKE '%claim%')
         AND le.date >= v_start_date AND le.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS claims_ratio_cur,

      (SELECT
         CASE
           WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
           THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%reinsurance%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
                 COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
           ELSE 0
         END
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE (a.name ILIKE '%gross%premium%' OR a.name ILIKE '%reinsurance%')
         AND le.date >= v_start_date AND le.date <= v_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS reinsurance_utilization_cur
  ),
  previous_period AS (
    SELECT
      (SELECT COALESCE(SUM(le.debit - le.credit), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Asset' AND a.name ILIKE '%premium%receivable%'
         AND le.date >= v_prev_start_date AND le.date <= v_prev_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS premium_receivables_prev,

      (SELECT COALESCE(ABS(SUM(le.credit - le.debit)), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Liability' AND a.name ILIKE '%commission%payable%'
         AND le.date >= v_prev_start_date AND le.date <= v_prev_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS commission_payable_prev,

      (SELECT COALESCE(SUM(le.credit - le.debit), 0)
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE a.type = 'Income' AND a.name ILIKE '%premium%'
         AND le.date >= v_prev_start_date AND le.date <= v_prev_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS premium_income_prev,

      (SELECT
         CASE
           WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
           THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%claim%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
                 COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
           ELSE 0
         END
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE (a.name ILIKE '%premium%' OR a.name ILIKE '%claim%')
         AND le.date >= v_prev_start_date AND le.date <= v_prev_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS claims_ratio_prev,

      (SELECT
         CASE
           WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
           THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%reinsurance%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
                 COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
           ELSE 0
         END
       FROM accounting.ledger_entries le
       JOIN accounting.accounts a ON a.id = le.account_id
       LEFT JOIN accounting.journal_lines jl ON jl.id = le.journal_line_id
       WHERE (a.name ILIKE '%gross%premium%' OR a.name ILIKE '%reinsurance%')
         AND le.date >= v_prev_start_date AND le.date <= v_prev_end_date
         AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
      ) AS reinsurance_utilization_prev
  )
  SELECT
    cp.premium_receivables_cur,
    cp.commission_payable_cur,
    cp.unreconciled_count_cur,
    cp.unreconciled_amount_cur,
    cp.premium_income_cur,
    cp.claims_ratio_cur,
    cp.reinsurance_utilization_cur,

    CASE WHEN pp.premium_receivables_prev = 0 THEN 0
      ELSE ROUND(((cp.premium_receivables_cur - pp.premium_receivables_prev) / ABS(pp.premium_receivables_prev) * 100)::numeric, 1)
    END,

    CASE WHEN pp.commission_payable_prev = 0 THEN 0
      ELSE ROUND(((cp.commission_payable_cur - pp.commission_payable_prev) / ABS(pp.commission_payable_prev) * 100)::numeric, 1)
    END,

    CASE WHEN pp.premium_income_prev = 0 THEN 0
      ELSE ROUND(((cp.premium_income_cur - pp.premium_income_prev) / ABS(pp.premium_income_prev) * 100)::numeric, 1)
    END,

    CASE WHEN pp.claims_ratio_prev = 0 THEN 0
      ELSE ROUND((cp.claims_ratio_cur - pp.claims_ratio_prev)::numeric, 1)
    END,

    CASE WHEN pp.reinsurance_utilization_prev = 0 THEN 0
      ELSE ROUND((cp.reinsurance_utilization_cur - pp.reinsurance_utilization_prev)::numeric, 1)
    END
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Upcoming Payments Function with Filters
-- =====================================================
CREATE OR REPLACE FUNCTION accounting.fn_dashboard_upcoming_payments(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_entity_ids BIGINT[] DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  due_date DATE,
  entity_name TEXT,
  description TEXT,
  amount NUMERIC,
  status TEXT,
  payment_status TEXT
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE + INTERVAL '30 days');

  RETURN QUERY
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
    AND j.date >= v_start_date
    AND j.date <= v_end_date
    AND (p_entity_ids IS NULL OR jl.entity_id = ANY(p_entity_ids))
  GROUP BY j.id, j.date, e.name, j.description, j.status
  ORDER BY j.date ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_financial_overview(DATE, DATE, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_performance_chart(INT, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_recent_transactions(DATE, DATE, BIGINT[], INT) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_marine_kpis(DATE, DATE, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_dashboard_upcoming_payments(DATE, DATE, BIGINT[], INT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION accounting.fn_dashboard_financial_overview IS 'Dashboard financial overview with date range and entity filtering';
COMMENT ON FUNCTION accounting.fn_dashboard_performance_chart IS 'Performance chart with entity filtering';
COMMENT ON FUNCTION accounting.fn_dashboard_recent_transactions IS 'Recent transactions with date range and entity filtering';
COMMENT ON FUNCTION accounting.fn_dashboard_marine_kpis IS 'Marine insurance KPIs with date range and entity filtering';
COMMENT ON FUNCTION accounting.fn_dashboard_upcoming_payments IS 'Upcoming payments with date range and entity filtering';
