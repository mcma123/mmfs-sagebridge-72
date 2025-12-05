-- =====================================================
-- Migration 025: Supabase RPC wrappers for note payment functions
-- =====================================================
-- Adds public schema wrappers for accounting.fn_mark_note_paid and
-- accounting.fn_record_partial_payment so they are callable via Supabase RPC.
-- Fixes 500 errors:
--   "Could not find the function public.fn_mark_note_paid(...) in the schema cache"
--   "Could not find the function public.fn_record_partial_payment(...) in the schema cache"

-- =====================================================
-- Wrapper: public.fn_mark_note_paid
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_mark_note_paid(
    p_bank_account_id INTEGER,
    p_created_by INTEGER,
    p_journal_id INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_payment_date DATE
)
RETURNS JSON
LANGUAGE sql
AS $$
  SELECT accounting.fn_mark_note_paid(
    p_journal_id := p_journal_id,
    p_bank_account_id := p_bank_account_id,
    p_payment_date := p_payment_date,
    p_created_by := p_created_by,
    p_notes := p_notes
  );
$$;

-- =====================================================
-- Wrapper: public.fn_record_partial_payment
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_record_partial_payment(
    p_amount DECIMAL(15,2),
    p_bank_account_id INTEGER,
    p_created_by INTEGER,
    p_journal_id INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_payment_date DATE
)
RETURNS JSON
LANGUAGE sql
AS $$
  SELECT accounting.fn_record_partial_payment(
    p_journal_id := p_journal_id,
    p_amount := p_amount,
    p_bank_account_id := p_bank_account_id,
    p_payment_date := p_payment_date,
    p_created_by := p_created_by,
    p_notes := p_notes
  );
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.fn_mark_note_paid(
  INTEGER, INTEGER, INTEGER, TEXT, DATE
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.fn_record_partial_payment(
  DECIMAL, INTEGER, INTEGER, INTEGER, TEXT, DATE
) TO anon, authenticated, service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================