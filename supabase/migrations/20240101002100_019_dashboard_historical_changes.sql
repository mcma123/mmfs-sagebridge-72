-- Dashboard Historical Change Calculations Migration
-- Adds month-over-month percentage changes to dashboard metrics

-- =====================================================
-- 1. Financial Overview with Historical Changes
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_financial_overview;
CREATE OR REPLACE VIEW accounting.v_dashboard_financial_overview AS
WITH current_period AS (
  SELECT
    COALESCE(SUM(CASE
      WHEN a.type = 'Asset' AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
      THEN (le.debit - le.credit)
      ELSE 0
    END), 0) AS total_cash_flow,

    COALESCE(SUM(CASE
      WHEN a.type = 'Asset' AND a.name ILIKE '%receivable%'
      THEN (le.debit - le.credit)
      ELSE 0
    END), 0) AS accounts_receivable,

    COALESCE(ABS(SUM(CASE
      WHEN a.type = 'Liability' AND a.name ILIKE '%payable%'
      THEN (le.credit - le.debit)
      ELSE 0
    END)), 0) AS accounts_payable,

    COALESCE(SUM(CASE
      WHEN a.type = 'Asset' AND a.name ILIKE '%bank%'
      THEN (le.debit - le.credit)
      ELSE 0
    END), 0) AS bank_balance
  FROM accounting.accounts a
  LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
    AND le.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
  WHERE a.is_active = TRUE
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
    AND le.date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE
    AND le.date < DATE_TRUNC('month', CURRENT_DATE)::DATE
  WHERE a.is_active = TRUE
)
SELECT
  cp.total_cash_flow,
  cp.accounts_receivable,
  cp.accounts_payable,
  cp.bank_balance,

  -- Calculate percentage changes with divide-by-zero protection
  CASE
    WHEN pp.total_cash_flow_prev = 0 THEN 0
    ELSE ROUND(((cp.total_cash_flow - pp.total_cash_flow_prev) / ABS(pp.total_cash_flow_prev) * 100)::numeric, 1)
  END AS total_cash_flow_change,

  CASE
    WHEN pp.accounts_receivable_prev = 0 THEN 0
    ELSE ROUND(((cp.accounts_receivable - pp.accounts_receivable_prev) / ABS(pp.accounts_receivable_prev) * 100)::numeric, 1)
  END AS accounts_receivable_change,

  CASE
    WHEN pp.accounts_payable_prev = 0 THEN 0
    ELSE ROUND(((cp.accounts_payable - pp.accounts_payable_prev) / ABS(pp.accounts_payable_prev) * 100)::numeric, 1)
  END AS accounts_payable_change,

  CASE
    WHEN pp.bank_balance_prev = 0 THEN 0
    ELSE ROUND(((cp.bank_balance - pp.bank_balance_prev) / ABS(pp.bank_balance_prev) * 100)::numeric, 1)
  END AS bank_balance_change
FROM current_period cp, previous_period pp;

-- =====================================================
-- 2. Marine Insurance KPIs with Historical Changes
-- =====================================================
DROP VIEW IF EXISTS accounting.v_dashboard_marine_kpis;
CREATE OR REPLACE VIEW accounting.v_dashboard_marine_kpis AS
WITH current_period AS (
  SELECT
    -- Premium Receivables
    (SELECT COALESCE(SUM(le.debit - le.credit), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Asset' AND a.name ILIKE '%premium%receivable%'
       AND le.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
    ) AS premium_receivables,

    -- Commission Payable
    (SELECT COALESCE(ABS(SUM(le.credit - le.debit)), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Liability' AND a.name ILIKE '%commission%payable%'
       AND le.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
    ) AS commission_payable,

    -- Unreconciled Payments
    (SELECT COUNT(*) FROM accounting.journals WHERE status IN ('draft', 'reviewed')) AS unreconciled_count,
    (SELECT COALESCE(SUM(ABS(jl.debit - jl.credit)), 0)
     FROM accounting.journals j
     JOIN accounting.journal_lines jl ON jl.journal_id = j.id
     WHERE j.status IN ('draft', 'reviewed')) AS unreconciled_amount,

    -- Premium Income (MTD)
    (SELECT COALESCE(SUM(le.credit - le.debit), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Income' AND a.name ILIKE '%premium%'
       AND DATE_TRUNC('month', le.date) = DATE_TRUNC('month', CURRENT_DATE)) AS premium_income_mtd,

    -- Claims Ratio (YTD)
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

    -- Reinsurance Utilization (YTD)
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
    ) AS reinsurance_utilization
),
previous_period AS (
  SELECT
    -- Premium Receivables (previous month)
    (SELECT COALESCE(SUM(le.debit - le.credit), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Asset' AND a.name ILIKE '%premium%receivable%'
       AND le.date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE
       AND le.date < DATE_TRUNC('month', CURRENT_DATE)::DATE
    ) AS premium_receivables_prev,

    -- Commission Payable (previous month)
    (SELECT COALESCE(ABS(SUM(le.credit - le.debit)), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Liability' AND a.name ILIKE '%commission%payable%'
       AND le.date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE
       AND le.date < DATE_TRUNC('month', CURRENT_DATE)::DATE
    ) AS commission_payable_prev,

    -- Premium Income (previous month)
    (SELECT COALESCE(SUM(le.credit - le.debit), 0)
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE a.type = 'Income' AND a.name ILIKE '%premium%'
       AND DATE_TRUNC('month', le.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')) AS premium_income_prev,

    -- Claims Ratio (previous year for YoY comparison)
    (SELECT
       CASE
         WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
         THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%claim%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
               COALESCE(SUM(CASE WHEN a.name ILIKE '%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
         ELSE 0
       END
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE DATE_TRUNC('year', le.date) = DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
       AND (a.name ILIKE '%premium%' OR a.name ILIKE '%claim%')
    ) AS claims_ratio_prev,

    -- Reinsurance Utilization (previous year)
    (SELECT
       CASE
         WHEN COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 0) > 0
         THEN (COALESCE(SUM(CASE WHEN a.name ILIKE '%reinsurance%' THEN le.debit - le.credit ELSE 0 END), 0) * 100.0 /
               COALESCE(SUM(CASE WHEN a.name ILIKE '%gross%premium%' THEN le.credit - le.debit ELSE 0 END), 1))
         ELSE 0
       END
     FROM accounting.ledger_entries le
     JOIN accounting.accounts a ON a.id = le.account_id
     WHERE DATE_TRUNC('year', le.date) = DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
       AND (a.name ILIKE '%gross%premium%' OR a.name ILIKE '%reinsurance%')
    ) AS reinsurance_utilization_prev
)
SELECT
  cp.premium_receivables,
  cp.commission_payable,
  cp.unreconciled_count,
  cp.unreconciled_amount,
  cp.premium_income_mtd,
  cp.claims_ratio,
  cp.reinsurance_utilization,

  -- Calculate percentage changes
  CASE
    WHEN pp.premium_receivables_prev = 0 THEN 0
    ELSE ROUND(((cp.premium_receivables - pp.premium_receivables_prev) / ABS(pp.premium_receivables_prev) * 100)::numeric, 1)
  END AS premium_receivables_change,

  CASE
    WHEN pp.commission_payable_prev = 0 THEN 0
    ELSE ROUND(((cp.commission_payable - pp.commission_payable_prev) / ABS(pp.commission_payable_prev) * 100)::numeric, 1)
  END AS commission_payable_change,

  CASE
    WHEN pp.premium_income_prev = 0 THEN 0
    ELSE ROUND(((cp.premium_income_mtd - pp.premium_income_prev) / ABS(pp.premium_income_prev) * 100)::numeric, 1)
  END AS premium_income_change,

  CASE
    WHEN pp.claims_ratio_prev = 0 THEN 0
    ELSE ROUND(((cp.claims_ratio - pp.claims_ratio_prev))::numeric, 1)
  END AS claims_ratio_change,

  CASE
    WHEN pp.reinsurance_utilization_prev = 0 THEN 0
    ELSE ROUND(((cp.reinsurance_utilization - pp.reinsurance_utilization_prev))::numeric, 1)
  END AS reinsurance_utilization_change
FROM current_period cp, previous_period pp;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT ON accounting.v_dashboard_financial_overview TO authenticated;
GRANT SELECT ON accounting.v_dashboard_marine_kpis TO authenticated;

-- Add helpful comments
COMMENT ON VIEW accounting.v_dashboard_financial_overview IS 'Dashboard financial overview with month-over-month percentage changes';
COMMENT ON VIEW accounting.v_dashboard_marine_kpis IS 'Marine insurance KPIs with historical percentage changes (MoM for financials, YoY for ratios)';
