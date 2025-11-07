-- Migration 013: Tax Reports System
-- Creates tables, views, and functions for managing tax returns with workflow approval
-- Status workflow: draft -> reviewed -> submitted
-- Supports: VAT, Employee Tax, Provisional Tax, Income Tax

-- ============================================================================
-- TABLES
-- ============================================================================

-- Main tax returns table
CREATE TABLE IF NOT EXISTS accounting.tax_returns (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('VAT', 'Employee_Tax', 'Provisional_Tax', 'Income_Tax')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'submitted')),
  submitted_date DATE NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  reference TEXT NULL,
  notes TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by BIGINT NULL
);

-- Index for filtering by status and type
CREATE INDEX IF NOT EXISTS idx_tax_returns_status ON accounting.tax_returns(status);
CREATE INDEX IF NOT EXISTS idx_tax_returns_type ON accounting.tax_returns(type);
CREATE INDEX IF NOT EXISTS idx_tax_returns_period ON accounting.tax_returns(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_returns_due_date ON accounting.tax_returns(due_date);

-- Tax return line items (detailed breakdown)
CREATE TABLE IF NOT EXISTS accounting.tax_return_lines (
  id BIGSERIAL PRIMARY KEY,
  tax_return_id BIGINT NOT NULL REFERENCES accounting.tax_returns(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  account_id BIGINT NULL REFERENCES accounting.accounts(id),
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster joins
CREATE INDEX IF NOT EXISTS idx_tax_return_lines_return_id ON accounting.tax_return_lines(tax_return_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Current tax liabilities from ledger
CREATE OR REPLACE VIEW accounting.v_tax_liabilities AS
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  COALESCE(SUM(le.credit - le.debit), 0) AS amount
FROM accounting.accounts a
LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
WHERE a.type = 'Liability'
  AND (a.name ILIKE '%tax%' OR a.name ILIKE '%vat%' OR a.name ILIKE '%paye%')
  AND a.is_active = TRUE
GROUP BY a.id, a.code, a.name
HAVING COALESCE(SUM(le.credit - le.debit), 0) > 0
ORDER BY a.code;

-- Public views for Supabase Data API access
CREATE OR REPLACE VIEW public.accounting_tax_returns AS
SELECT
  id,
  type,
  period_start,
  period_end,
  due_date,
  status,
  submitted_date,
  amount,
  reference,
  notes,
  created_by,
  created_at,
  updated_at,
  reviewed_at,
  reviewed_by
FROM accounting.tax_returns;

CREATE OR REPLACE VIEW public.accounting_tax_return_lines AS
SELECT
  id,
  tax_return_id,
  description,
  account_id,
  amount,
  is_manual_override,
  created_at
FROM accounting.tax_return_lines;

CREATE OR REPLACE VIEW public.accounting_tax_liabilities AS
SELECT
  account_id,
  code,
  name,
  amount
FROM accounting.v_tax_liabilities;

-- ============================================================================
-- GRANTS (for Supabase Data API)
-- ============================================================================

GRANT SELECT ON public.accounting_tax_returns TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_tax_return_lines TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_tax_liabilities TO anon, authenticated, service_role;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Calculate VAT for a period (South African 15% standard rate)
-- Returns the net VAT amount (output VAT - input VAT)
CREATE OR REPLACE FUNCTION accounting.fn_calculate_vat_for_period(
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_output_vat NUMERIC DEFAULT 0;
  v_input_vat NUMERIC DEFAULT 0;
  v_net_vat NUMERIC DEFAULT 0;
BEGIN
  -- Calculate output VAT (15% of revenue/income)
  SELECT COALESCE(SUM(le.credit - le.debit) * 0.15, 0) INTO v_output_vat
  FROM accounting.ledger_entries le
  JOIN accounting.accounts a ON a.id = le.account_id
  WHERE a.type = 'Revenue'
    AND a.is_active = TRUE
    AND le.date >= p_start
    AND le.date <= p_end;

  -- Calculate input VAT (15% of expenses)
  SELECT COALESCE(SUM(le.debit - le.credit) * 0.15, 0) INTO v_input_vat
  FROM accounting.ledger_entries le
  JOIN accounting.accounts a ON a.id = le.account_id
  WHERE a.type = 'Expense'
    AND a.is_active = TRUE
    AND le.date >= p_start
    AND le.date <= p_end;

  -- Net VAT = output VAT - input VAT
  v_net_vat := v_output_vat - v_input_vat;

  RETURN v_net_vat;
END;
$$ LANGUAGE plpgsql;

-- Function: Create tax return with auto-calculated amount
CREATE OR REPLACE FUNCTION public.fn_create_tax_return(
  p_type TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_due_date DATE,
  p_created_by BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tax_return_id BIGINT;
  v_calculated_amount NUMERIC DEFAULT 0;
  v_result JSONB;
BEGIN
  -- Calculate amount based on type
  IF p_type = 'VAT' THEN
    v_calculated_amount := accounting.fn_calculate_vat_for_period(p_period_start, p_period_end);
  ELSE
    -- For other tax types, start with 0 (requires manual entry or future calculation logic)
    v_calculated_amount := 0;
  END IF;

  -- Insert tax return
  INSERT INTO accounting.tax_returns (
    type, period_start, period_end, due_date, amount, status, created_by
  ) VALUES (
    p_type, p_period_start, p_period_end, p_due_date, v_calculated_amount, 'draft', p_created_by
  ) RETURNING id INTO v_tax_return_id;

  -- Create line items for VAT breakdown
  IF p_type = 'VAT' AND v_calculated_amount != 0 THEN
    -- Output VAT line
    INSERT INTO accounting.tax_return_lines (
      tax_return_id, description, amount, is_manual_override
    )
    SELECT
      v_tax_return_id,
      'Output VAT (15% of revenue)',
      COALESCE(SUM(le.credit - le.debit) * 0.15, 0),
      FALSE
    FROM accounting.ledger_entries le
    JOIN accounting.accounts a ON a.id = le.account_id
    WHERE a.type = 'Revenue'
      AND a.is_active = TRUE
      AND le.date >= p_period_start
      AND le.date <= p_period_end;

    -- Input VAT line (negative amount)
    INSERT INTO accounting.tax_return_lines (
      tax_return_id, description, amount, is_manual_override
    )
    SELECT
      v_tax_return_id,
      'Input VAT (15% of expenses)',
      -COALESCE(SUM(le.debit - le.credit) * 0.15, 0),
      FALSE
    FROM accounting.ledger_entries le
    JOIN accounting.accounts a ON a.id = le.account_id
    WHERE a.type = 'Expense'
      AND a.is_active = TRUE
      AND le.date >= p_period_start
      AND le.date <= p_period_end;
  END IF;

  -- Return result with lines
  SELECT jsonb_build_object(
    'id', tr.id,
    'type', tr.type,
    'period_start', tr.period_start,
    'period_end', tr.period_end,
    'due_date', tr.due_date,
    'status', tr.status,
    'amount', tr.amount,
    'lines', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', trl.id,
        'description', trl.description,
        'amount', trl.amount,
        'is_manual_override', trl.is_manual_override
      ))
      FROM accounting.tax_return_lines trl
      WHERE trl.tax_return_id = tr.id),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM accounting.tax_returns tr
  WHERE tr.id = v_tax_return_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Review tax return (mark as reviewed)
CREATE OR REPLACE FUNCTION public.fn_review_tax_return(
  p_tax_return_id BIGINT,
  p_reviewed_by BIGINT
) RETURNS VOID AS $$
BEGIN
  -- Check if tax return exists and is in draft status
  IF NOT EXISTS (
    SELECT 1 FROM accounting.tax_returns
    WHERE id = p_tax_return_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Tax return not found or not in draft status';
  END IF;

  -- Update status to reviewed
  UPDATE accounting.tax_returns
  SET
    status = 'reviewed',
    reviewed_at = NOW(),
    reviewed_by = p_reviewed_by,
    updated_at = NOW()
  WHERE id = p_tax_return_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Submit tax return (mark as submitted)
CREATE OR REPLACE FUNCTION public.fn_submit_tax_return(
  p_tax_return_id BIGINT,
  p_submitted_by BIGINT,
  p_submitted_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
BEGIN
  -- Check if tax return exists and is draft or reviewed
  IF NOT EXISTS (
    SELECT 1 FROM accounting.tax_returns
    WHERE id = p_tax_return_id AND status IN ('draft', 'reviewed')
  ) THEN
    RAISE EXCEPTION 'Tax return not found or already submitted';
  END IF;

  -- Update status to submitted
  UPDATE accounting.tax_returns
  SET
    status = 'submitted',
    submitted_date = p_submitted_date,
    updated_at = NOW()
  WHERE id = p_tax_return_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get upcoming tax deadlines (next 90 days)
-- Returns suggested tax returns that should be created
CREATE OR REPLACE FUNCTION public.fn_get_upcoming_tax_deadlines()
RETURNS TABLE (
  type TEXT,
  period_start DATE,
  period_end DATE,
  due_date DATE,
  suggested_amount NUMERIC
) AS $$
BEGIN
  -- This is a simplified version that suggests quarterly VAT returns
  -- In production, this could be configurable based on company registration

  RETURN QUERY
  WITH quarters AS (
    -- Get next 2 quarters
    SELECT
      'VAT'::TEXT AS tax_type,
      date_trunc('quarter', CURRENT_DATE)::DATE AS q_start,
      (date_trunc('quarter', CURRENT_DATE) + interval '3 months' - interval '1 day')::DATE AS q_end,
      (date_trunc('quarter', CURRENT_DATE) + interval '3 months' + interval '25 days')::DATE AS q_due
    UNION ALL
    SELECT
      'VAT'::TEXT,
      (date_trunc('quarter', CURRENT_DATE) + interval '3 months')::DATE,
      (date_trunc('quarter', CURRENT_DATE) + interval '6 months' - interval '1 day')::DATE,
      (date_trunc('quarter', CURRENT_DATE) + interval '6 months' + interval '25 days')::DATE
  )
  SELECT
    q.tax_type,
    q.q_start,
    q.q_end,
    q.q_due,
    COALESCE(accounting.fn_calculate_vat_for_period(q.q_start, q.q_end), 0) AS suggested_amount
  FROM quarters q
  WHERE q.q_due <= CURRENT_DATE + interval '90 days'
    AND NOT EXISTS (
      -- Don't suggest if already exists
      SELECT 1 FROM accounting.tax_returns tr
      WHERE tr.type = q.tax_type
        AND tr.period_start = q.q_start
        AND tr.period_end = q.q_end
    )
  ORDER BY q.q_due;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS FOR RPC FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.fn_create_tax_return TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_review_tax_return TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_submit_tax_return TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_upcoming_tax_deadlines TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION accounting.fn_calculate_vat_for_period TO anon, authenticated, service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE accounting.tax_returns IS 'Tax return records with workflow approval (draft -> reviewed -> submitted)';
COMMENT ON TABLE accounting.tax_return_lines IS 'Detailed line items for tax returns with manual override capability';
COMMENT ON VIEW accounting.v_tax_liabilities IS 'Current tax liability balances from ledger entries';
COMMENT ON FUNCTION public.fn_create_tax_return IS 'Create tax return with auto-calculated amount (VAT: 15% rate)';
COMMENT ON FUNCTION public.fn_review_tax_return IS 'Mark tax return as reviewed (workflow step)';
COMMENT ON FUNCTION public.fn_submit_tax_return IS 'Mark tax return as submitted (final workflow step)';
COMMENT ON FUNCTION public.fn_get_upcoming_tax_deadlines IS 'Get suggested tax returns for next 90 days';
COMMENT ON FUNCTION accounting.fn_calculate_vat_for_period IS 'Calculate net VAT for period (output VAT - input VAT at 15%)';
