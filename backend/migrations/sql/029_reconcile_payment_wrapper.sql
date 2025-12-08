-- =====================================================
-- 029: Supabase RPC wrapper for reconcile payment
-- =====================================================
-- Exposes accounting.fn_reconcile_payment via public schema
-- so that Supabase RPC `fn_reconcile_payment` works.

CREATE OR REPLACE FUNCTION public.fn_reconcile_payment(
  p_journal_id INTEGER,
  p_created_by INTEGER
)
RETURNS JSON
LANGUAGE sql
AS $$
  SELECT accounting.fn_reconcile_payment(
    p_journal_id := p_journal_id,
    p_created_by := p_created_by
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_reconcile_payment(
  INTEGER,
  INTEGER
) TO anon, authenticated, service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================