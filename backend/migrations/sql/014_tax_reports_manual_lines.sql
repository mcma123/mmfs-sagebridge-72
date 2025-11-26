-- Migration 014: Tax Reports Manual Line Items Support
-- Updates fn_create_tax_return to accept optional user-provided line items
-- When line items are provided, they are used instead of auto-calculation

-- ============================================================================
-- UPDATE FUNCTION: fn_create_tax_return with optional lines parameter
-- ============================================================================

-- Drop and recreate the function with new signature
DROP FUNCTION IF EXISTS public.fn_create_tax_return(TEXT, DATE, DATE, DATE, BIGINT);

CREATE OR REPLACE FUNCTION public.fn_create_tax_return(
  p_type TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_due_date DATE,
  p_created_by BIGINT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL  -- Optional user-provided line items
) RETURNS JSONB AS $$
DECLARE
  v_tax_return_id BIGINT;
  v_calculated_amount NUMERIC DEFAULT 0;
  v_user_amount NUMERIC DEFAULT 0;
  v_use_user_lines BOOLEAN DEFAULT FALSE;
  v_line JSONB;
  v_result JSONB;
BEGIN
  -- Check if user provided line items
  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    v_use_user_lines := TRUE;
    -- Calculate total from user-provided lines
    SELECT COALESCE(SUM((line->>'amount')::NUMERIC), 0)
    INTO v_user_amount
    FROM jsonb_array_elements(p_lines) AS line;
    v_calculated_amount := v_user_amount;
  ELSE
    -- Calculate amount based on type (existing auto-calculation logic)
    IF p_type = 'VAT' THEN
      v_calculated_amount := accounting.fn_calculate_vat_for_period(p_period_start, p_period_end);
    ELSE
      -- For other tax types, start with 0 (requires manual entry or future calculation logic)
      v_calculated_amount := 0;
    END IF;
  END IF;

  -- Insert tax return
  INSERT INTO accounting.tax_returns (
    type, period_start, period_end, due_date, amount, status, created_by
  ) VALUES (
    p_type, p_period_start, p_period_end, p_due_date, v_calculated_amount, 'draft', p_created_by
  ) RETURNING id INTO v_tax_return_id;

  -- Create line items
  IF v_use_user_lines THEN
    -- Insert user-provided line items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      INSERT INTO accounting.tax_return_lines (
        tax_return_id,
        description,
        account_id,
        amount,
        is_manual_override
      ) VALUES (
        v_tax_return_id,
        COALESCE(v_line->>'description', 'Manual Entry'),
        NULLIF((v_line->>'account_id')::TEXT, '')::BIGINT,
        COALESCE((v_line->>'amount')::NUMERIC, 0),
        TRUE  -- Mark as manual override since user provided these
      );
    END LOOP;
  ELSIF p_type = 'VAT' AND v_calculated_amount != 0 THEN
    -- Auto-generate VAT line items (existing logic)
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
    'created_by', tr.created_by,
    'created_at', tr.created_at,
    'lines', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', trl.id,
        'description', trl.description,
        'account_id', trl.account_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.fn_create_tax_return(TEXT, DATE, DATE, DATE, BIGINT, JSONB) TO anon, authenticated, service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.fn_create_tax_return IS 'Create tax return with auto-calculated amount (VAT: 15% rate) or user-provided line items. When p_lines is provided, those are used instead of auto-calculation.';