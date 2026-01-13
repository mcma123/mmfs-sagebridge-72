-- Create banking schema and import tables
CREATE SCHEMA IF NOT EXISTS banking;

-- Import Sessions
-- Tracks each CSV import session with status and metadata
CREATE TABLE IF NOT EXISTS banking.import_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'mapped', 'staged', 'committed', 'cancelled')),
  totals_json JSONB DEFAULT '{}',
  mapping_template_id BIGINT NULL
);

-- Import Mapping Templates
-- Stores reusable CSV column mapping configurations per bank
CREATE TABLE IF NOT EXISTS banking.import_mapping_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NULL,
  header_map_json JSONB DEFAULT '{}',
  transforms_json JSONB DEFAULT '{}',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import Transactions
-- Staged normalized transactions from CSV with validation status
CREATE TABLE IF NOT EXISTS banking.import_transactions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  row_index INTEGER NOT NULL,
  date DATE NULL,
  description TEXT NULL,
  amount NUMERIC(18,2) NULL,
  debit NUMERIC(18,2) NULL,
  credit NUMERIC(18,2) NULL,
  account_code TEXT NULL,
  reference TEXT NULL,
  currency TEXT NULL DEFAULT 'ZAR',
  validation_status TEXT DEFAULT 'unmapped' CHECK (validation_status IN ('valid', 'invalid', 'duplicate', 'unmapped')),
  duplicate_flag BOOLEAN DEFAULT FALSE,
  excluded BOOLEAN DEFAULT FALSE,
  edit_history_json JSONB DEFAULT '[]',
  row_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_import_transactions_session
    FOREIGN KEY (session_id)
    REFERENCES banking.import_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT uk_session_row_hash UNIQUE (session_id, row_hash)
);

-- Import Errors
-- Validation errors per row and field
CREATE TABLE IF NOT EXISTS banking.import_errors (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  row_index INTEGER NOT NULL,
  field TEXT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_import_errors_session
    FOREIGN KEY (session_id)
    REFERENCES banking.import_sessions(id)
    ON DELETE CASCADE
);

-- Import Audit Events
-- Complete audit trail of all actions on import sessions
CREATE TABLE IF NOT EXISTS banking.import_audit_events (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  actor_id BIGINT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details_json JSONB DEFAULT '{}',
  CONSTRAINT fk_import_audit_session
    FOREIGN KEY (session_id)
    REFERENCES banking.import_sessions(id)
    ON DELETE CASCADE
);

-- Add foreign key for mapping template after both tables exist
ALTER TABLE banking.import_sessions
  DROP CONSTRAINT IF EXISTS fk_import_sessions_template,
  ADD CONSTRAINT fk_import_sessions_template
    FOREIGN KEY (mapping_template_id)
    REFERENCES banking.import_mapping_templates(id)
    ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_sessions_user ON banking.import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON banking.import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created ON banking.import_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_transactions_session ON banking.import_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_import_transactions_validation ON banking.import_transactions(validation_status);
CREATE INDEX IF NOT EXISTS idx_import_transactions_duplicate ON banking.import_transactions(duplicate_flag) WHERE duplicate_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_import_transactions_excluded ON banking.import_transactions(excluded) WHERE excluded = FALSE;
CREATE INDEX IF NOT EXISTS idx_import_transactions_date ON banking.import_transactions(date);
CREATE INDEX IF NOT EXISTS idx_import_transactions_account ON banking.import_transactions(account_code);

CREATE INDEX IF NOT EXISTS idx_import_errors_session ON banking.import_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_row ON banking.import_errors(session_id, row_index);

CREATE INDEX IF NOT EXISTS idx_import_audit_session ON banking.import_audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_timestamp ON banking.import_audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_import_audit_actor ON banking.import_audit_events(actor_id);

CREATE INDEX IF NOT EXISTS idx_import_templates_bank ON banking.import_mapping_templates(bank);
CREATE INDEX IF NOT EXISTS idx_import_templates_created_by ON banking.import_mapping_templates(created_by);

-- Comments for documentation
COMMENT ON SCHEMA banking IS 'Banking module for CSV import and transaction management';
COMMENT ON TABLE banking.import_sessions IS 'Tracks each CSV import session with status and metadata';
COMMENT ON TABLE banking.import_mapping_templates IS 'Reusable CSV column mapping configurations per bank';
COMMENT ON TABLE banking.import_transactions IS 'Staged normalized transactions from CSV with validation status';
COMMENT ON TABLE banking.import_errors IS 'Validation errors per row and field';
COMMENT ON TABLE banking.import_audit_events IS 'Complete audit trail of all actions on import sessions';

COMMENT ON COLUMN banking.import_transactions.row_hash IS 'SHA256 hash of normalized row data for duplicate detection';
COMMENT ON COLUMN banking.import_transactions.edit_history_json IS 'Array of edit events: [{timestamp, field, old_value, new_value, actor_id}]';
COMMENT ON COLUMN banking.import_sessions.totals_json IS 'Computed totals: {total_rows, valid_rows, invalid_rows, duplicate_rows, excluded_rows, total_debit, total_credit}';
COMMENT ON COLUMN banking.import_mapping_templates.header_map_json IS 'Maps CSV headers to system fields: {"CSV Header": "date", ...}';
COMMENT ON COLUMN banking.import_mapping_templates.transforms_json IS 'Transform flags: {invert_signs, fixed_currency, default_account_code}';
