-- Migration 011: Journal Workflow (Draft → Reviewed → Posted)
-- Purpose: Add workflow status and tracking columns to accounting.journals,
--          create RPCs for draft/review/post, and update public views.

-- 1. Add workflow columns to accounting.journals
DO $$ 
BEGIN
  -- Add status column with check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'accounting' 
    AND table_name = 'journals' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE accounting.journals 
    ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft','reviewed','posted'));
  END IF;
  
  -- Add other workflow columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'accounting' 
    AND table_name = 'journals' 
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE accounting.journals ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'accounting' 
    AND table_name = 'journals' 
    AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE accounting.journals ADD COLUMN reviewed_by BIGINT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'accounting' 
    AND table_name = 'journals' 
    AND column_name = 'posted_at'
  ) THEN
    ALTER TABLE accounting.journals ADD COLUMN posted_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'accounting' 
    AND table_name = 'journals' 
    AND column_name = 'posted_by'
  ) THEN
    ALTER TABLE accounting.journals ADD COLUMN posted_by BIGINT;
  END IF;
END $$;

COMMENT ON COLUMN accounting.journals.status IS 'Workflow status: draft (unposted), reviewed (approved but unposted), posted (final)';
COMMENT ON COLUMN accounting.journals.reviewed_at IS 'Timestamp when journal was reviewed';
COMMENT ON COLUMN accounting.journals.reviewed_by IS 'User ID who reviewed the journal';
COMMENT ON COLUMN accounting.journals.posted_at IS 'Timestamp when journal was posted to ledger';
COMMENT ON COLUMN accounting.journals.posted_by IS 'User ID who posted the journal';

-- 2. Update existing fn_post_journal to set status='posted' and posted_at/posted_by
CREATE OR REPLACE FUNCTION public.fn_post_journal(
  p_date DATE,
  p_reference TEXT,
  p_description TEXT,
  p_created_by BIGINT,
  p_lines JSONB
)
RETURNS BIGINT AS $$
DECLARE
  v_journal_id BIGINT;
  v_total_debit NUMERIC(18,2) := 0;
  v_total_credit NUMERIC(18,2) := 0;
  v_line JSONB;
  v_account_id BIGINT;
  v_entity_id BIGINT;
  v_line_date DATE;
  v_debit NUMERIC(18,2);
  v_credit NUMERIC(18,2);
  v_memo TEXT;
  v_line_id BIGINT;
BEGIN
  -- Validate lines
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'lines[] required' USING ERRCODE = '22023';
  END IF;

  -- Insert journal with status='posted' (immediate posting)
  INSERT INTO accounting.journals(date, reference, description, created_by, status, posted_at, posted_by)
  VALUES(p_date, p_reference, p_description, p_created_by, 'posted', NOW(), p_created_by)
  RETURNING id INTO v_journal_id;

  -- Insert lines
  FOR v_line IN SELECT jsonb_array_elements(p_lines) LOOP
    v_account_id := (v_line->>'account_id')::BIGINT;
    v_entity_id := NULLIF(v_line->>'entity_id','')::BIGINT;
    v_line_date := COALESCE(NULLIF(v_line->>'date','')::DATE, p_date);
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);
    v_memo := v_line->>'memo';

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'account_id required for each line' USING ERRCODE = '22023';
    END IF;
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'debit/credit must be >= 0' USING ERRCODE = '22023';
    END IF;

    INSERT INTO accounting.journal_lines(journal_id, account_id, entity_id, date, debit, credit, memo)
    VALUES(v_journal_id, v_account_id, v_entity_id, v_line_date, v_debit, v_credit, v_memo)
    RETURNING id INTO v_line_id;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;

    -- Write ledger entry
    INSERT INTO accounting.ledger_entries(account_id, journal_line_id, date, debit, credit, balance_after)
    VALUES(v_account_id, v_line_id, v_line_date, v_debit, v_credit, NULL);
  END LOOP;

  -- Must be balanced
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'journal not balanced: debit % != credit %', v_total_debit, v_total_credit USING ERRCODE = '22023';
  END IF;

  RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_post_journal IS 'Posts a balanced journal directly to ledger with status=posted';

-- 3. Create fn_create_journal_draft (allows unbalanced, no ledger entries)
CREATE OR REPLACE FUNCTION public.fn_create_journal_draft(
  p_date DATE,
  p_reference TEXT,
  p_description TEXT,
  p_created_by BIGINT,
  p_lines JSONB
)
RETURNS BIGINT AS $$
DECLARE
  v_journal_id BIGINT;
  v_line JSONB;
  v_account_id BIGINT;
  v_entity_id BIGINT;
  v_line_date DATE;
  v_debit NUMERIC(18,2);
  v_credit NUMERIC(18,2);
  v_memo TEXT;
BEGIN
  -- Validate lines
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'lines[] required' USING ERRCODE = '22023';
  END IF;

  -- Insert journal as draft
  INSERT INTO accounting.journals(date, reference, description, created_by, status)
  VALUES(p_date, p_reference, p_description, p_created_by, 'draft')
  RETURNING id INTO v_journal_id;

  -- Insert lines (no ledger entries for drafts)
  FOR v_line IN SELECT jsonb_array_elements(p_lines) LOOP
    v_account_id := (v_line->>'account_id')::BIGINT;
    v_entity_id := NULLIF(v_line->>'entity_id','')::BIGINT;
    v_line_date := COALESCE(NULLIF(v_line->>'date','')::DATE, p_date);
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);
    v_memo := v_line->>'memo';

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'account_id required for each line' USING ERRCODE = '22023';
    END IF;
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'debit/credit must be >= 0' USING ERRCODE = '22023';
    END IF;

    INSERT INTO accounting.journal_lines(journal_id, account_id, entity_id, date, debit, credit, memo)
    VALUES(v_journal_id, v_account_id, v_entity_id, v_line_date, v_debit, v_credit, v_memo);
  END LOOP;

  RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_create_journal_draft IS 'Creates a draft journal (no balance validation, no ledger entries)';

-- 4. Create fn_review_journal
CREATE OR REPLACE FUNCTION public.fn_review_journal(
  p_journal_id BIGINT,
  p_reviewed_by BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE accounting.journals
  SET status = 'reviewed',
      reviewed_at = NOW(),
      reviewed_by = p_reviewed_by
  WHERE id = p_journal_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal not found or not in draft status' USING ERRCODE = '22023';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_review_journal IS 'Marks a draft journal as reviewed';

-- 5. Create fn_post_journal_from_draft
CREATE OR REPLACE FUNCTION public.fn_post_journal_from_draft(
  p_journal_id BIGINT,
  p_posted_by BIGINT
)
RETURNS BIGINT AS $$
DECLARE
  v_total_debit NUMERIC(18,2) := 0;
  v_total_credit NUMERIC(18,2) := 0;
  v_line RECORD;
  v_journal_status TEXT;
BEGIN
  -- Check journal exists and is reviewable (draft or reviewed)
  SELECT status INTO v_journal_status
  FROM accounting.journals
  WHERE id = p_journal_id;

  IF v_journal_status IS NULL THEN
    RAISE EXCEPTION 'Journal not found' USING ERRCODE = '22023';
  END IF;

  IF v_journal_status = 'posted' THEN
    RAISE EXCEPTION 'Journal already posted' USING ERRCODE = '22023';
  END IF;

  -- Calculate totals from existing lines
  FOR v_line IN 
    SELECT id, account_id, date, debit, credit
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id
  LOOP
    v_total_debit := v_total_debit + v_line.debit;
    v_total_credit := v_total_credit + v_line.credit;

    -- Write ledger entry
    INSERT INTO accounting.ledger_entries(account_id, journal_line_id, date, debit, credit, balance_after)
    VALUES(v_line.account_id, v_line.id, v_line.date, v_line.debit, v_line.credit, NULL);
  END LOOP;

  -- Must be balanced
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'journal not balanced: debit % != credit %', v_total_debit, v_total_credit USING ERRCODE = '22023';
  END IF;

  -- Mark as posted
  UPDATE accounting.journals
  SET status = 'posted',
      posted_at = NOW(),
      posted_by = p_posted_by
  WHERE id = p_journal_id;

  RETURN p_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_post_journal_from_draft IS 'Posts a draft/reviewed journal to ledger after validating balance';

-- 6. Update public.accounting_journals view to include workflow columns and total_amount
DROP VIEW IF EXISTS public.accounting_journals CASCADE;
CREATE VIEW public.accounting_journals AS
SELECT 
  j.id,
  j.date,
  j.reference,
  j.description,
  j.created_by,
  j.created_at,
  j.voided_at,
  j.status,
  j.reviewed_at,
  j.reviewed_by,
  j.posted_at,
  j.posted_by,
  (SELECT COALESCE(SUM(jl.debit), 0)
   FROM accounting.journal_lines jl
   WHERE jl.journal_id = j.id) AS total_amount
FROM accounting.journals j;

COMMENT ON VIEW public.accounting_journals IS 'Public view of journals with workflow status and computed total';

-- Re-grant permissions
GRANT SELECT ON public.accounting_journals TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_journal_draft TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_review_journal TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_post_journal_from_draft TO anon, authenticated, service_role;

