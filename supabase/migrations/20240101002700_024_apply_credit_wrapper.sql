-- =====================================================
-- Migration 024: Supabase RPC wrapper for fn_apply_credit_to_debit
-- =====================================================
-- Fixes: 500 "Could not find the function public.fn_apply_credit_to_debit(...) in the schema cache"
-- When backend calls req.db.rpc('fn_apply_credit_to_debit', ...), Supabase expects a
-- function in the public schema. The core implementation already exists as:
--   accounting.fn_apply_credit_to_debit(
--     p_credit_note_id INTEGER,
--     p_debit_note_id  INTEGER,
--     p_amount         DECIMAL(15,2),
--     p_applied_date   DATE,
--     p_created_by     INTEGER,
--     p_notes          TEXT DEFAULT NULL
--   )
-- This migration adds a small public.fn_apply_credit_to_debit wrapper that calls the
-- accounting.* function with named parameters, so the existing backend RPC call works.

-- =====================================================
-- SAFETY: only create wrapper if it does not exist, or replace to keep idempotent
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_apply_credit_to_debit(
    p_amount        DECIMAL(15,2),
    p_applied_date  DATE,
    p_created_by    INTEGER,
    p_credit_note_id INTEGER,
    p_debit_note_id  INTEGER,
    p_notes         TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
AS $$
  SELECT accounting.fn_apply_credit_to_debit(
    p_credit_note_id := p_credit_note_id,
    p_debit_note_id  := p_debit_note_id,
    p_amount         := p_amount,
    p_applied_date   := p_applied_date,
    p_created_by     := p_created_by,
    p_notes          := p_notes
  );
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.fn_apply_credit_to_debit(
  DECIMAL, DATE, INTEGER, INTEGER, INTEGER, TEXT
) TO anon, authenticated, service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================