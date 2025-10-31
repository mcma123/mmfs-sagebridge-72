-- Create accounting schema and core tables
CREATE SCHEMA IF NOT EXISTS accounting;

-- Entities
CREATE TABLE IF NOT EXISTS accounting.entities (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NULL,
  currency TEXT NULL,
  country TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounting.accounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NULL,
  parent_id BIGINT NULL REFERENCES accounting.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journals
CREATE TABLE IF NOT EXISTS accounting.journals (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  reference TEXT NULL,
  description TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Lines
CREATE TABLE IF NOT EXISTS accounting.journal_lines (
  id BIGSERIAL PRIMARY KEY,
  journal_id BIGINT NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounting.accounts(id) ON DELETE RESTRICT,
  entity_id BIGINT NULL REFERENCES accounting.entities(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  memo TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Entries
CREATE TABLE IF NOT EXISTS accounting.ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounting.accounts(id) ON DELETE RESTRICT,
  journal_line_id BIGINT NOT NULL REFERENCES accounting.journal_lines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(18,2) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simple current trial balance view
-- Drop dependent public alias first to avoid dependency errors during re-runs
DROP VIEW IF EXISTS public.accounting_trial_balance_current;
DROP VIEW IF EXISTS accounting.v_trial_balance_current;
CREATE VIEW accounting.v_trial_balance_current AS
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  COALESCE(SUM(le.debit) - SUM(le.credit), 0) AS balance
FROM accounting.accounts a
LEFT JOIN accounting.ledger_entries le ON le.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;

-- Helper: ensure updated_at refresh
CREATE OR REPLACE FUNCTION accounting.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_accounts_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_accounts_touch_updated_at
    BEFORE UPDATE ON accounting.accounts
    FOR EACH ROW EXECUTE PROCEDURE accounting.touch_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_journals_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_journals_touch_updated_at
    BEFORE UPDATE ON accounting.journals
    FOR EACH ROW EXECUTE PROCEDURE accounting.touch_updated_at();
  END IF;
END $$;

-- RPC: Post a journal with lines; returns journal_id
-- Note: define in public schema so Supabase rpc('fn_post_journal', ...) can resolve it
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

  -- Insert journal
  INSERT INTO accounting.journals(date, reference, description, created_by)
  VALUES(p_date, p_reference, p_description, p_created_by)
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

COMMENT ON FUNCTION public.fn_post_journal IS 'Posts a balanced journal into accounting schema and returns journal_id';