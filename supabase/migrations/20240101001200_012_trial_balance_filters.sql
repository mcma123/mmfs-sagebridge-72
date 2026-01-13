-- Migration 012: Trial Balance Date Filtering Support
-- Purpose: Add SQL function for date-filtered trial balance queries
-- Dependencies: 007_accounting_init.sql (accounting schema and tables)

-- Drop existing function if re-running migration
DROP FUNCTION IF EXISTS accounting.fn_trial_balance_asof(DATE);

-- Create function to calculate trial balance as of a specific date
-- Returns same structure as v_trial_balance_current view for consistency
CREATE OR REPLACE FUNCTION accounting.fn_trial_balance_asof(
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_id BIGINT,
  code TEXT,
  name TEXT,
  type TEXT,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.code,
    a.name,
    a.type,
    COALESCE(SUM(le.debit) - SUM(le.credit), 0) AS balance
  FROM accounting.accounts a
  LEFT JOIN accounting.ledger_entries le
    ON le.account_id = a.id
    AND le.date <= p_as_of_date  -- Filter by date
  WHERE a.is_active = true  -- Only include active accounts
  GROUP BY a.id, a.code, a.name, a.type
  ORDER BY a.code;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to required roles
GRANT EXECUTE ON FUNCTION accounting.fn_trial_balance_asof(DATE) TO anon, authenticated, service_role;

-- Add helpful comment
COMMENT ON FUNCTION accounting.fn_trial_balance_asof(DATE) IS
  'Calculates trial balance as of a specific date by filtering ledger entries. Defaults to current date if no parameter provided.';
