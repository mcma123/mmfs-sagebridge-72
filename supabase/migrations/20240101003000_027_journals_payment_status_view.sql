-- 027: Update public.accounting_journals view to expose payment and reconciliation fields
-- This keeps the codebase in sync with the Supabase migration applied via MCP.

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
  -- Payment tracking fields from notes / reconciliation migrations
  j.payment_status,
  j.paid_amount,
  j.recorded_at,
  j.received_at,
  -- Total amount (debit side) used by the frontend
  (
    SELECT COALESCE(SUM(jl.debit), 0)
    FROM accounting.journal_lines jl
    WHERE jl.journal_id = j.id
  ) AS total_amount
FROM accounting.journals j;

COMMENT ON VIEW public.accounting_journals IS
  'Public view of journals including workflow, payment, and reconciliation fields.';

GRANT SELECT ON public.accounting_journals TO anon, authenticated, service_role;