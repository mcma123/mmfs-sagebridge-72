-- Public API views and RPC functions to expose accounting data via Supabase Data API
-- This avoids requiring the 'accounting' schema to be in Exposed Schemas

-- Entities view
DROP VIEW IF EXISTS public.accounting_entities CASCADE;
CREATE VIEW public.accounting_entities AS
SELECT id, type, name, status, currency, country, email, phone, notes, created_at, updated_at
FROM accounting.entities;

-- Accounts view
DROP VIEW IF EXISTS public.accounting_accounts CASCADE;
CREATE VIEW public.accounting_accounts AS
SELECT id, code, name, type, currency, parent_id, is_active, created_at
FROM accounting.accounts;

-- Journals view
DROP VIEW IF EXISTS public.accounting_journals CASCADE;
CREATE VIEW public.accounting_journals AS
SELECT id, date, reference, description, created_by, created_at
FROM accounting.journals;

-- Ledger entries view
DROP VIEW IF EXISTS public.accounting_ledger_entries CASCADE;
CREATE VIEW public.accounting_ledger_entries AS
SELECT id, account_id, journal_line_id, date, debit, credit, balance_after, created_at
FROM accounting.ledger_entries;

-- Trial balance alias view (current)
DROP VIEW IF EXISTS public.accounting_trial_balance_current CASCADE;
CREATE VIEW public.accounting_trial_balance_current AS
SELECT * FROM accounting.v_trial_balance_current;

-- Grants so Data API roles can read (service_role already has broad perms)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_entities TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_accounts TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_journals TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_ledger_entries TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_trial_balance_current TO anon, authenticated, service_role;

-- RPC: create/update helpers for entities and accounts
-- Create Entity
CREATE OR REPLACE FUNCTION public.fn_create_entity(
  p_type TEXT,
  p_name TEXT,
  p_status TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS accounting.entities AS $$
DECLARE v_row accounting.entities;
BEGIN
  IF p_type IS NULL OR p_name IS NULL THEN
    RAISE EXCEPTION 'type and name required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO accounting.entities(type, name, status, currency, country, email, phone, notes)
  VALUES(p_type, p_name, p_status, p_currency, p_country, p_email, p_phone, p_notes)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Entity (partial update via COALESCE)
CREATE OR REPLACE FUNCTION public.fn_update_entity(
  p_id BIGINT,
  p_type TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS accounting.entities AS $$
DECLARE v_row accounting.entities;
BEGIN
  UPDATE accounting.entities SET
    type = COALESCE(p_type, type),
    name = COALESCE(p_name, name),
    status = COALESCE(p_status, status),
    currency = COALESCE(p_currency, currency),
    country = COALESCE(p_country, country),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    notes = COALESCE(p_notes, notes),
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity id % not found', p_id USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Account
CREATE OR REPLACE FUNCTION public.fn_create_account(
  p_code TEXT,
  p_name TEXT,
  p_type TEXT,
  p_currency TEXT DEFAULT NULL,
  p_parent_id BIGINT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS accounting.accounts AS $$
DECLARE v_row accounting.accounts;
BEGIN
  IF p_code IS NULL OR p_name IS NULL OR p_type IS NULL THEN
    RAISE EXCEPTION 'code, name, type required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO accounting.accounts(code, name, type, currency, parent_id, is_active)
  VALUES(p_code, p_name, p_type, p_currency, p_parent_id, COALESCE(p_is_active, TRUE))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Account (partial update via COALESCE)
CREATE OR REPLACE FUNCTION public.fn_update_account(
  p_id BIGINT,
  p_code TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_parent_id BIGINT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS accounting.accounts AS $$
DECLARE v_row accounting.accounts;
BEGIN
  UPDATE accounting.accounts SET
    code = COALESCE(p_code, code),
    name = COALESCE(p_name, name),
    type = COALESCE(p_type, type),
    currency = COALESCE(p_currency, currency),
    parent_id = COALESCE(p_parent_id, parent_id),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account id % not found', p_id USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON VIEW public.accounting_entities IS 'Public view for accounting.entities';
COMMENT ON VIEW public.accounting_accounts IS 'Public view for accounting.accounts';
COMMENT ON VIEW public.accounting_journals IS 'Public view for accounting.journals';
COMMENT ON VIEW public.accounting_ledger_entries IS 'Public view for accounting.ledger_entries';
COMMENT ON VIEW public.accounting_trial_balance_current IS 'Public view alias for accounting.v_trial_balance_current';
COMMENT ON FUNCTION public.fn_create_entity IS 'RPC: create an entity in accounting schema and return row';
COMMENT ON FUNCTION public.fn_update_entity IS 'RPC: update an entity in accounting schema and return row';
COMMENT ON FUNCTION public.fn_create_account IS 'RPC: create an account in accounting schema and return row';
COMMENT ON FUNCTION public.fn_update_account IS 'RPC: update an account in accounting schema and return row';