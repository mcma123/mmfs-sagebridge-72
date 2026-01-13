-- Accounting actions support: soft delete entities, void journals, expose journal lines
-- Safe to re-run: uses IF NOT EXISTS where applicable and CREATE OR REPLACE for views/functions

-- Soft delete support on entities
ALTER TABLE accounting.entities
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Void support on journals
ALTER TABLE accounting.journals
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Ensure journal_lines has required columns across environments
ALTER TABLE accounting.journal_lines
  ADD COLUMN IF NOT EXISTS debit NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE accounting.journal_lines
  ADD COLUMN IF NOT EXISTS credit NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE accounting.journal_lines
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE VIEW public.accounting_journal_lines AS
SELECT id, journal_id, account_id, entity_id, date, debit, credit, memo, created_at
FROM accounting.journal_lines;

-- Update public entities view to include deleted_at
DROP VIEW IF EXISTS public.accounting_entities;
CREATE OR REPLACE VIEW public.accounting_entities AS
SELECT id, type, name, status, currency, country, email, phone, notes, created_at, updated_at, deleted_at
FROM accounting.entities;

-- Update public journals view to include voided_at
DROP VIEW IF EXISTS public.accounting_journals;
CREATE OR REPLACE VIEW public.accounting_journals AS
SELECT id, date, reference, description, created_by, created_at, voided_at
FROM accounting.journals;

GRANT SELECT ON public.accounting_journal_lines TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_entities TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_journals TO anon, authenticated, service_role;

-- RPC: Void a journal by posting a balanced reversal and marking original voided
CREATE OR REPLACE FUNCTION public.fn_void_journal(
  p_journal_id BIGINT,
  p_created_by BIGINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_journal RECORD;
  v_reversal_id BIGINT;
  v_lines JSONB := '[]'::jsonb;
  v_line RECORD;
BEGIN
  SELECT * INTO v_journal FROM accounting.journals WHERE id = p_journal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'journal % not found', p_journal_id USING ERRCODE = '22023';
  END IF;
  IF v_journal.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'journal % already voided', p_journal_id USING ERRCODE = '22023';
  END IF;

  -- Build reversal lines by swapping debit/credit per original line
  FOR v_line IN SELECT * FROM accounting.journal_lines WHERE journal_id = p_journal_id LOOP
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_line.account_id,
        'entity_id', v_line.entity_id,
        'date', v_line.date,
        'debit', v_line.credit,
        'credit', v_line.debit,
        'memo', COALESCE(v_line.memo, '')
      )
    );
  END LOOP;

  v_reversal_id := public.fn_post_journal(
    v_journal.date,
    v_journal.reference,
    CONCAT('VOID reversal of journal ', p_journal_id,
           CASE WHEN p_reason IS NOT NULL THEN CONCAT(' - ', p_reason) ELSE '' END),
    p_created_by,
    v_lines
  );

  UPDATE accounting.journals
  SET voided_at = NOW(), updated_at = NOW()
  WHERE id = p_journal_id;

  RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON VIEW public.accounting_journal_lines IS 'Public view for accounting.journal_lines';
COMMENT ON VIEW public.accounting_journals IS 'Public view for accounting.journals with voided_at';
COMMENT ON FUNCTION public.fn_void_journal IS 'RPC: void a journal by posting reversal and marking original as voided';