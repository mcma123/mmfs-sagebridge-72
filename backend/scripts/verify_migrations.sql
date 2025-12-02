-- Verification script for journal workflow migrations
-- Run this to check if migrations 010 and 011 are applied

\echo '=== Checking for workflow functions ==='
SELECT 
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_review_journal', 'fn_post_journal_from_draft', 'fn_void_journal', 'fn_create_journal_draft')
ORDER BY p.proname;

\echo ''
\echo '=== Checking for workflow columns on accounting.journals ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'journals'
  AND column_name IN ('status', 'reviewed_at', 'reviewed_by', 'posted_at', 'posted_by', 'voided_at')
ORDER BY column_name;

\echo ''
\echo '=== Checking public.accounting_journals view columns ==='
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_journals'
ORDER BY ordinal_position;

\echo ''
\echo '=== Sample data from accounting.journals ==='
SELECT id, date, reference, status, reviewed_at, posted_at, voided_at
FROM accounting.journals
ORDER BY id DESC
LIMIT 5;















