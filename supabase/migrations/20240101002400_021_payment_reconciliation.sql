-- Migration: Payment Reconciliation System
-- Description: Tables for bank transaction import, reconciliation matching, and payment allocation
-- Date: 2024-01-20

-- ============================================================================
-- 1. Bank Transactions Table
-- ============================================================================
-- Store imported bank statements or manually entered payments awaiting allocation

CREATE TABLE IF NOT EXISTS accounting.bank_transactions (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    reference VARCHAR(100),
    description TEXT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount != 0),
    bank_account_id INTEGER,
    entity_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'unallocated'
        CHECK (status IN ('unallocated', 'matched', 'partially_matched', 'ignored')),
    matched_amount DECIMAL(15,2) DEFAULT 0 CHECK (matched_amount >= 0),
    import_batch_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES app.users(id),
    updated_at TIMESTAMP,
    notes TEXT,
    CONSTRAINT valid_matched_amount CHECK (ABS(matched_amount) <= ABS(amount))
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON accounting.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON accounting.bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_entity ON accounting.bank_transactions(entity_name);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON accounting.bank_transactions(import_batch_id);

COMMENT ON TABLE accounting.bank_transactions IS 'Imported or manually entered bank transactions awaiting reconciliation';
COMMENT ON COLUMN accounting.bank_transactions.status IS 'unallocated: not matched yet, matched: fully allocated, partially_matched: some allocated, ignored: marked to skip';
COMMENT ON COLUMN accounting.bank_transactions.matched_amount IS 'Total amount allocated to accounting records';


-- ============================================================================
-- 2. Reconciliation Batches Table
-- ============================================================================
-- Track bank statement import sessions and reconciliation progress

CREATE TABLE IF NOT EXISTS accounting.reconciliation_batches (
    id SERIAL PRIMARY KEY,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    total_transactions INTEGER DEFAULT 0 CHECK (total_transactions >= 0),
    matched_count INTEGER DEFAULT 0 CHECK (matched_count >= 0),
    total_amount DECIMAL(15,2),
    matched_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES app.users(id),
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES app.users(id),
    CONSTRAINT valid_matched_count CHECK (matched_count <= total_transactions)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_batches_status ON accounting.reconciliation_batches(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_batches_date ON accounting.reconciliation_batches(batch_date);

COMMENT ON TABLE accounting.reconciliation_batches IS 'Bank statement import and reconciliation session tracking';


-- ============================================================================
-- 3. Payment Allocations Table
-- ============================================================================
-- Many-to-many: Link bank transactions to accounting journals (notes, invoices, etc.)

CREATE TABLE IF NOT EXISTS accounting.payment_allocations (
    id SERIAL PRIMARY KEY,
    bank_transaction_id INTEGER NOT NULL REFERENCES accounting.bank_transactions(id) ON DELETE CASCADE,
    journal_id INTEGER NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15,2) NOT NULL CHECK (allocated_amount != 0),
    match_score DECIMAL(5,2) CHECK (match_score >= 0 AND match_score <= 100),
    match_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES app.users(id),
    notes TEXT,
    UNIQUE (bank_transaction_id, journal_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_bank_tx ON accounting.payment_allocations(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_journal ON accounting.payment_allocations(journal_id);

COMMENT ON TABLE accounting.payment_allocations IS 'Links bank transactions to accounting records with allocation amounts';
COMMENT ON COLUMN accounting.payment_allocations.match_score IS 'Confidence score (0-100) from matching algorithm';
COMMENT ON COLUMN accounting.payment_allocations.match_type IS 'How match was made: auto_exact, auto_fuzzy, manual, etc.';


-- ============================================================================
-- 4. Extend Journals Table for Recorded vs Received Tracking
-- ============================================================================
-- Add timestamps to distinguish when transaction was recorded vs when money actually received/paid

-- Add recorded_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounting'
        AND table_name = 'journals'
        AND column_name = 'recorded_at'
    ) THEN
        ALTER TABLE accounting.journals ADD COLUMN recorded_at TIMESTAMP;
        COMMENT ON COLUMN accounting.journals.recorded_at IS 'When the transaction was recorded in the system';
    END IF;
END $$;

-- Backfill recorded_at separately - disable trigger temporarily to avoid updated_at conflict
ALTER TABLE accounting.journals DISABLE TRIGGER trg_journals_touch_updated_at;

UPDATE accounting.journals
SET recorded_at = posted_at
WHERE recorded_at IS NULL AND posted_at IS NOT NULL AND status = 'Posted';

ALTER TABLE accounting.journals ENABLE TRIGGER trg_journals_touch_updated_at;

-- Add received_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounting'
        AND table_name = 'journals'
        AND column_name = 'received_at'
    ) THEN
        ALTER TABLE accounting.journals ADD COLUMN received_at TIMESTAMP;
        COMMENT ON COLUMN accounting.journals.received_at IS 'When the payment was actually received (from bank reconciliation)';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journals_recorded_at ON accounting.journals(recorded_at);
CREATE INDEX IF NOT EXISTS idx_journals_received_at ON accounting.journals(received_at);


-- ============================================================================
-- 5. Views for Reconciliation
-- ============================================================================

-- Outstanding Items View: Unpaid/Partial Debit Notes
CREATE OR REPLACE VIEW accounting.vw_outstanding_receivables AS
WITH journal_totals AS (
    SELECT
        j.id,
        j.date AS journal_date,
        j.reference,
        j.description,
        j.status,
        j.payment_status,
        j.paid_amount,
        j.recorded_at,
        j.received_at,
        COALESCE(SUM(jl.debit), 0) AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        (SELECT entity_id FROM accounting.journal_lines WHERE journal_id = j.id LIMIT 1) AS entity_id
    FROM accounting.journals j
    LEFT JOIN accounting.journal_lines jl ON j.id = jl.journal_id
    WHERE j.reference LIKE 'DN-%'
      AND j.status = 'Posted'
      AND j.payment_status IN ('unpaid', 'partial')
    GROUP BY j.id, j.date, j.reference, j.description, j.status, j.payment_status, j.paid_amount, j.recorded_at, j.received_at
)
SELECT
    jt.id AS journal_id,
    jt.reference,
    jt.journal_date,
    jt.description,
    e.name AS entity_name,
    e.id AS entity_id,
    jt.total_debit AS total_amount,
    jt.paid_amount,
    (jt.total_debit - COALESCE(jt.paid_amount, 0)) AS outstanding_amount,
    jt.payment_status,
    jt.recorded_at,
    jt.received_at,
    CURRENT_DATE - jt.journal_date AS days_outstanding,
    CASE
        WHEN CURRENT_DATE - jt.journal_date <= 30 THEN '0-30'
        WHEN CURRENT_DATE - jt.journal_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - jt.journal_date <= 90 THEN '61-90'
        ELSE '90+'
    END AS aging_bucket
FROM journal_totals jt
LEFT JOIN accounting.entities e ON jt.entity_id = e.id
WHERE (jt.total_debit - COALESCE(jt.paid_amount, 0)) > 0.01
ORDER BY jt.journal_date ASC;

COMMENT ON VIEW accounting.vw_outstanding_receivables IS 'All unpaid or partially paid debit notes with amounts due';


-- Available Credit Notes View
CREATE OR REPLACE VIEW accounting.vw_available_credits AS
WITH journal_totals AS (
    SELECT
        j.id,
        j.date AS journal_date,
        j.reference,
        j.description,
        j.status,
        j.payment_status,
        j.paid_amount,
        COALESCE(SUM(jl.debit), 0) AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        (SELECT entity_id FROM accounting.journal_lines WHERE journal_id = j.id LIMIT 1) AS entity_id
    FROM accounting.journals j
    LEFT JOIN accounting.journal_lines jl ON j.id = jl.journal_id
    WHERE j.reference LIKE 'CN-%'
      AND j.status = 'Posted'
      AND j.payment_status = 'unpaid'
    GROUP BY j.id, j.date, j.reference, j.description, j.status, j.payment_status, j.paid_amount
)
SELECT
    jt.id AS journal_id,
    jt.reference,
    jt.journal_date,
    jt.description,
    e.name AS entity_name,
    e.id AS entity_id,
    jt.total_credit AS total_amount,
    jt.paid_amount AS applied_amount,
    (jt.total_credit - COALESCE(jt.paid_amount, 0)) AS available_amount,
    jt.payment_status
FROM journal_totals jt
LEFT JOIN accounting.entities e ON jt.entity_id = e.id
WHERE (jt.total_credit - COALESCE(jt.paid_amount, 0)) > 0.01
ORDER BY jt.journal_date ASC;

COMMENT ON VIEW accounting.vw_available_credits IS 'Unused credit notes available for application to debit notes';


-- Unallocated Payments View
CREATE OR REPLACE VIEW accounting.vw_unallocated_payments AS
SELECT
    bt.id,
    bt.transaction_date,
    bt.reference,
    bt.description,
    bt.amount,
    bt.entity_name,
    bt.matched_amount,
    (bt.amount - COALESCE(bt.matched_amount, 0)) AS unallocated_amount,
    bt.status,
    bt.created_at,
    rb.description AS batch_description
FROM accounting.bank_transactions bt
LEFT JOIN accounting.reconciliation_batches rb ON bt.import_batch_id = rb.id
WHERE bt.status IN ('unallocated', 'partially_matched')
  AND ABS(bt.amount - COALESCE(bt.matched_amount, 0)) > 0.01
ORDER BY bt.transaction_date DESC;

COMMENT ON VIEW accounting.vw_unallocated_payments IS 'Bank transactions not yet fully allocated to accounting records';


-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function: Calculate string similarity (for entity name matching)
CREATE OR REPLACE FUNCTION accounting.fn_string_similarity(str1 TEXT, str2 TEXT)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    len1 INT;
    len2 INT;
    lev_dist INT;
    max_len INT;
BEGIN
    IF str1 IS NULL OR str2 IS NULL THEN
        RETURN 0;
    END IF;

    str1 := LOWER(TRIM(str1));
    str2 := LOWER(TRIM(str2));

    IF str1 = str2 THEN
        RETURN 100;
    END IF;

    len1 := LENGTH(str1);
    len2 := LENGTH(str2);
    max_len := GREATEST(len1, len2);

    IF max_len = 0 THEN
        RETURN 100;
    END IF;

    -- Simple Levenshtein-like calculation
    lev_dist := levenshtein(str1, str2);

    RETURN ROUND(((max_len - lev_dist)::DECIMAL / max_len) * 100, 2);
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback to simple substring matching if levenshtein not available
        IF str1 LIKE '%' || str2 || '%' OR str2 LIKE '%' || str1 || '%' THEN
            RETURN 60;
        ELSE
            RETURN 0;
        END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION accounting.fn_string_similarity IS 'Calculate similarity score (0-100) between two strings using Levenshtein distance';


-- Function: Update bank transaction status based on allocations
CREATE OR REPLACE FUNCTION accounting.fn_update_bank_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
    total_allocated DECIMAL(15,2);
    transaction_amount DECIMAL(15,2);
BEGIN
    -- Calculate total allocated amount for this bank transaction
    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO total_allocated
    FROM accounting.payment_allocations
    WHERE bank_transaction_id = COALESCE(NEW.bank_transaction_id, OLD.bank_transaction_id);

    -- Get transaction amount
    SELECT amount INTO transaction_amount
    FROM accounting.bank_transactions
    WHERE id = COALESCE(NEW.bank_transaction_id, OLD.bank_transaction_id);

    -- Update bank transaction status
    UPDATE accounting.bank_transactions
    SET
        matched_amount = total_allocated,
        status = CASE
            WHEN ABS(total_allocated) < 0.01 THEN 'unallocated'
            WHEN ABS(ABS(total_allocated) - ABS(transaction_amount)) < 0.01 THEN 'matched'
            ELSE 'partially_matched'
        END,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.bank_transaction_id, OLD.bank_transaction_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update bank transaction status
DROP TRIGGER IF EXISTS trg_update_bank_transaction_status ON accounting.payment_allocations;
CREATE TRIGGER trg_update_bank_transaction_status
    AFTER INSERT OR UPDATE OR DELETE ON accounting.payment_allocations
    FOR EACH ROW
    EXECUTE FUNCTION accounting.fn_update_bank_transaction_status();

COMMENT ON FUNCTION accounting.fn_update_bank_transaction_status IS 'Automatically update bank transaction status when allocations change';


-- ============================================================================
-- 7. Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON accounting.bank_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounting.reconciliation_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounting.payment_allocations TO authenticated;
GRANT USAGE ON SEQUENCE accounting.bank_transactions_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE accounting.reconciliation_batches_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE accounting.payment_allocations_id_seq TO authenticated;
GRANT SELECT ON accounting.vw_outstanding_receivables TO authenticated;
GRANT SELECT ON accounting.vw_available_credits TO authenticated;
GRANT SELECT ON accounting.vw_unallocated_payments TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_string_similarity TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
