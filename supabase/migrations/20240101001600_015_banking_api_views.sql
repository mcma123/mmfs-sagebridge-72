-- Public API views to expose banking data via Supabase Data API
-- Mirrors the pattern used by accounting module (009_accounting_api_views.sql)
-- This avoids requiring the 'banking' schema to be in Exposed Schemas

-- Import Sessions view
DROP VIEW IF EXISTS public.banking_import_sessions CASCADE;
CREATE VIEW public.banking_import_sessions AS
SELECT *
FROM banking.import_sessions;

-- Import Transactions view
DROP VIEW IF EXISTS public.banking_import_transactions CASCADE;
CREATE VIEW public.banking_import_transactions AS
SELECT *
FROM banking.import_transactions;

-- Import Mapping Templates view
DROP VIEW IF EXISTS public.banking_import_mapping_templates CASCADE;
CREATE VIEW public.banking_import_mapping_templates AS
SELECT *
FROM banking.import_mapping_templates;

-- Import Audit Events view
DROP VIEW IF EXISTS public.banking_import_audit_events CASCADE;
CREATE VIEW public.banking_import_audit_events AS
SELECT *
FROM banking.import_audit_events;

-- Import Errors view
DROP VIEW IF EXISTS public.banking_import_errors CASCADE;
CREATE VIEW public.banking_import_errors AS
SELECT *
FROM banking.import_errors;

-- Grant permissions (Supabase roles)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.banking_import_sessions TO anon, authenticated, service_role;
GRANT SELECT ON public.banking_import_transactions TO anon, authenticated, service_role;
GRANT SELECT ON public.banking_import_mapping_templates TO anon, authenticated, service_role;
GRANT SELECT ON public.banking_import_audit_events TO anon, authenticated, service_role;
GRANT SELECT ON public.banking_import_errors TO anon, authenticated, service_role;

-- Allow inserts/updates through views (for Supabase operations)
-- Simple views allow DML operations to pass through to underlying tables
GRANT INSERT, UPDATE, DELETE ON public.banking_import_sessions TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.banking_import_transactions TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.banking_import_mapping_templates TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.banking_import_audit_events TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.banking_import_errors TO authenticated, service_role;

-- Comments for documentation
COMMENT ON VIEW public.banking_import_sessions IS 'Public view for banking.import_sessions - Supabase accessible';
COMMENT ON VIEW public.banking_import_transactions IS 'Public view for banking.import_transactions - Supabase accessible';
COMMENT ON VIEW public.banking_import_mapping_templates IS 'Public view for banking.import_mapping_templates - Supabase accessible';
COMMENT ON VIEW public.banking_import_audit_events IS 'Public view for banking.import_audit_events - Supabase accessible';
COMMENT ON VIEW public.banking_import_errors IS 'Public view for banking.import_errors - Supabase accessible';
