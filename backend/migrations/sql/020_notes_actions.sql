-- =====================================================
-- Migration 020: Debit/Credit Notes Actions Support
-- =====================================================
-- Adds payment tracking, credit applications, and action support for notes

-- =====================================================
-- TABLES
-- =====================================================

-- Table: Note Payments
-- Tracks payment transactions for debit and credit notes
CREATE TABLE IF NOT EXISTS accounting.note_payments (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    payment_journal_id INTEGER REFERENCES accounting.journals(id) ON DELETE SET NULL,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('full', 'partial', 'refund')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    bank_account_id INTEGER REFERENCES accounting.accounts(id) ON DELETE RESTRICT,
    reconciled_at TIMESTAMP,
    reconciled_by INTEGER REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES app.users(id) ON DELETE SET NULL,
    notes TEXT
);

-- Table: Note Applications
-- Tracks credit note applications to debit notes
CREATE TABLE IF NOT EXISTS accounting.note_applications (
    id SERIAL PRIMARY KEY,
    credit_note_id INTEGER NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    debit_note_id INTEGER NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    application_journal_id INTEGER REFERENCES accounting.journals(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    applied_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES app.users(id) ON DELETE SET NULL,
    notes TEXT,
    CONSTRAINT unique_credit_debit_application UNIQUE (credit_note_id, debit_note_id)
);

-- Add payment tracking columns to journals table
DO $$
BEGIN
    -- Add payment_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounting'
        AND table_name = 'journals'
        AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE accounting.journals
        ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'reconciled', 'n/a'));
    END IF;

    -- Add paid_amount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounting'
        AND table_name = 'journals'
        AND column_name = 'paid_amount'
    ) THEN
        ALTER TABLE accounting.journals
        ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0 CHECK (paid_amount >= 0);
    END IF;

    -- Add reconciled_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounting'
        AND table_name = 'journals'
        AND column_name = 'reconciled_at'
    ) THEN
        ALTER TABLE accounting.journals
        ADD COLUMN reconciled_at TIMESTAMP;
    END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_note_payments_journal ON accounting.note_payments(journal_id);
CREATE INDEX IF NOT EXISTS idx_note_payments_payment_journal ON accounting.note_payments(payment_journal_id);
CREATE INDEX IF NOT EXISTS idx_note_payments_date ON accounting.note_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_note_applications_credit ON accounting.note_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_note_applications_debit ON accounting.note_applications(debit_note_id);
CREATE INDEX IF NOT EXISTS idx_journals_payment_status ON accounting.journals(payment_status);
CREATE INDEX IF NOT EXISTS idx_journals_reference_prefix ON accounting.journals(reference) WHERE reference LIKE 'DN-%' OR reference LIKE 'CN-%';

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Function: Mark Note as Paid
-- Creates a payment journal entry (DR Cash/Bank, CR AR/AP)
CREATE OR REPLACE FUNCTION accounting.fn_mark_note_paid(
    p_journal_id INTEGER,
    p_bank_account_id INTEGER,
    p_payment_date DATE,
    p_created_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_note_record RECORD;
    v_payment_journal_id INTEGER;
    v_payment_reference TEXT;
    v_ar_account_id INTEGER;
    v_total_amount DECIMAL(15,2);
    v_result JSON;
BEGIN
    -- Get the note details
    SELECT j.*, j.reference, j.description
    INTO v_note_record
    FROM accounting.journals j
    WHERE j.id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal not found: %', p_journal_id;
    END IF;

    -- Check if already paid
    IF v_note_record.payment_status IN ('paid', 'reconciled') THEN
        RAISE EXCEPTION 'Note is already marked as paid';
    END IF;

    -- Check if voided
    IF v_note_record.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot mark voided note as paid';
    END IF;

    -- Calculate total amount from journal lines
    SELECT COALESCE(SUM(debit), 0) INTO v_total_amount
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id AND debit > 0;

    -- Determine if this is a debit note (DN-) or credit note (CN-)
    IF v_note_record.reference LIKE 'DN-%' THEN
        -- Debit Note: DR Cash/Bank, CR Accounts Receivable
        -- Find AR account from original journal
        SELECT account_id INTO v_ar_account_id
        FROM accounting.journal_lines
        WHERE journal_id = p_journal_id AND debit > 0
        LIMIT 1;

        v_payment_reference := 'PMT-' || v_note_record.reference;

        -- Create payment journal
        INSERT INTO accounting.journals (date, reference, description, created_by, payment_status)
        VALUES (
            p_payment_date,
            v_payment_reference,
            'Payment received for ' || v_note_record.reference,
            p_created_by,
            'n/a'
        )
        RETURNING id INTO v_payment_journal_id;

        -- DR Cash/Bank
        INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
        VALUES (
            v_payment_journal_id,
            p_bank_account_id,
            p_payment_date,
            v_total_amount,
            0,
            'Payment for ' || v_note_record.reference
        );

        -- CR Accounts Receivable
        INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
        VALUES (
            v_payment_journal_id,
            v_ar_account_id,
            p_payment_date,
            0,
            v_total_amount,
            'Payment for ' || v_note_record.reference
        );

    ELSE
        RAISE EXCEPTION 'Invalid note type for payment. Only debit notes (DN-) can be marked as paid.';
    END IF;

    -- Record payment
    INSERT INTO accounting.note_payments (
        journal_id,
        payment_journal_id,
        payment_type,
        amount,
        payment_date,
        bank_account_id,
        created_by,
        notes
    ) VALUES (
        p_journal_id,
        v_payment_journal_id,
        'full',
        v_total_amount,
        p_payment_date,
        p_bank_account_id,
        p_created_by,
        p_notes
    );

    -- Update journal status
    UPDATE accounting.journals
    SET payment_status = 'paid',
        paid_amount = v_total_amount
    WHERE id = p_journal_id;

    v_result := json_build_object(
        'success', true,
        'journal_id', p_journal_id,
        'payment_journal_id', v_payment_journal_id,
        'amount', v_total_amount,
        'payment_reference', v_payment_reference
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Record Partial Payment
CREATE OR REPLACE FUNCTION accounting.fn_record_partial_payment(
    p_journal_id INTEGER,
    p_amount DECIMAL(15,2),
    p_bank_account_id INTEGER,
    p_payment_date DATE,
    p_created_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_note_record RECORD;
    v_payment_journal_id INTEGER;
    v_payment_reference TEXT;
    v_ar_account_id INTEGER;
    v_total_amount DECIMAL(15,2);
    v_new_paid_amount DECIMAL(15,2);
    v_new_status TEXT;
    v_result JSON;
BEGIN
    -- Get the note details
    SELECT j.*, j.reference, j.description
    INTO v_note_record
    FROM accounting.journals j
    WHERE j.id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal not found: %', p_journal_id;
    END IF;

    -- Check if voided
    IF v_note_record.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot record payment for voided note';
    END IF;

    -- Calculate total amount
    SELECT COALESCE(SUM(debit), 0) INTO v_total_amount
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id AND debit > 0;

    -- Calculate new paid amount
    v_new_paid_amount := COALESCE(v_note_record.paid_amount, 0) + p_amount;

    -- Validate partial payment amount
    IF v_new_paid_amount > v_total_amount THEN
        RAISE EXCEPTION 'Partial payment amount exceeds total note amount';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Determine new status
    IF v_new_paid_amount >= v_total_amount THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partial';
    END IF;

    -- Get AR account
    SELECT account_id INTO v_ar_account_id
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id AND debit > 0
    LIMIT 1;

    v_payment_reference := 'PMT-' || v_note_record.reference || '-P' || (SELECT COUNT(*) + 1 FROM accounting.note_payments WHERE journal_id = p_journal_id);

    -- Create payment journal
    INSERT INTO accounting.journals (date, reference, description, created_by, payment_status)
    VALUES (
        p_payment_date,
        v_payment_reference,
        'Partial payment for ' || v_note_record.reference,
        p_created_by,
        'n/a'
    )
    RETURNING id INTO v_payment_journal_id;

    -- DR Cash/Bank
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_payment_journal_id,
        p_bank_account_id,
        p_payment_date,
        p_amount,
        0,
        'Partial payment for ' || v_note_record.reference
    );

    -- CR Accounts Receivable
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_payment_journal_id,
        v_ar_account_id,
        p_payment_date,
        0,
        p_amount,
        'Partial payment for ' || v_note_record.reference
    );

    -- Record payment
    INSERT INTO accounting.note_payments (
        journal_id,
        payment_journal_id,
        payment_type,
        amount,
        payment_date,
        bank_account_id,
        created_by,
        notes
    ) VALUES (
        p_journal_id,
        v_payment_journal_id,
        'partial',
        p_amount,
        p_payment_date,
        p_bank_account_id,
        p_created_by,
        p_notes
    );

    -- Update journal status
    UPDATE accounting.journals
    SET payment_status = v_new_status,
        paid_amount = v_new_paid_amount
    WHERE id = p_journal_id;

    v_result := json_build_object(
        'success', true,
        'journal_id', p_journal_id,
        'payment_journal_id', v_payment_journal_id,
        'amount', p_amount,
        'total_paid', v_new_paid_amount,
        'remaining', v_total_amount - v_new_paid_amount,
        'status', v_new_status,
        'payment_reference', v_payment_reference
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Reconcile Payment
CREATE OR REPLACE FUNCTION accounting.fn_reconcile_payment(
    p_journal_id INTEGER,
    p_created_by INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_note_record RECORD;
    v_result JSON;
BEGIN
    -- Get the note details
    SELECT * INTO v_note_record
    FROM accounting.journals
    WHERE id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal not found: %', p_journal_id;
    END IF;

    -- Check if paid
    IF v_note_record.payment_status NOT IN ('paid', 'partial') THEN
        RAISE EXCEPTION 'Note must be paid or partially paid before reconciliation';
    END IF;

    -- Check if already reconciled
    IF v_note_record.payment_status = 'reconciled' THEN
        RAISE EXCEPTION 'Payment is already reconciled';
    END IF;

    -- Update journal to reconciled status
    UPDATE accounting.journals
    SET payment_status = 'reconciled',
        reconciled_at = NOW()
    WHERE id = p_journal_id;

    -- Update payment records
    UPDATE accounting.note_payments
    SET reconciled_at = NOW(),
        reconciled_by = p_created_by
    WHERE journal_id = p_journal_id
      AND reconciled_at IS NULL;

    v_result := json_build_object(
        'success', true,
        'journal_id', p_journal_id,
        'reconciled_at', NOW()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Apply Credit to Debit Note
CREATE OR REPLACE FUNCTION accounting.fn_apply_credit_to_debit(
    p_credit_note_id INTEGER,
    p_debit_note_id INTEGER,
    p_amount DECIMAL(15,2),
    p_applied_date DATE,
    p_created_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_credit_note RECORD;
    v_debit_note RECORD;
    v_application_journal_id INTEGER;
    v_application_reference TEXT;
    v_ap_account_id INTEGER;
    v_ar_account_id INTEGER;
    v_credit_total DECIMAL(15,2);
    v_debit_total DECIMAL(15,2);
    v_result JSON;
BEGIN
    -- Get credit note details
    SELECT * INTO v_credit_note
    FROM accounting.journals
    WHERE id = p_credit_note_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit note not found: %', p_credit_note_id;
    END IF;

    IF v_credit_note.reference NOT LIKE 'CN-%' THEN
        RAISE EXCEPTION 'Journal % is not a credit note', p_credit_note_id;
    END IF;

    IF v_credit_note.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot apply voided credit note';
    END IF;

    -- Get debit note details
    SELECT * INTO v_debit_note
    FROM accounting.journals
    WHERE id = p_debit_note_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debit note not found: %', p_debit_note_id;
    END IF;

    IF v_debit_note.reference NOT LIKE 'DN-%' THEN
        RAISE EXCEPTION 'Journal % is not a debit note', p_debit_note_id;
    END IF;

    IF v_debit_note.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot apply to voided debit note';
    END IF;

    -- Calculate totals
    SELECT COALESCE(SUM(credit), 0) INTO v_credit_total
    FROM accounting.journal_lines
    WHERE journal_id = p_credit_note_id AND credit > 0;

    SELECT COALESCE(SUM(debit), 0) INTO v_debit_total
    FROM accounting.journal_lines
    WHERE journal_id = p_debit_note_id AND debit > 0;

    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Application amount must be greater than zero';
    END IF;

    IF p_amount > v_credit_total THEN
        RAISE EXCEPTION 'Application amount exceeds credit note total';
    END IF;

    IF p_amount > v_debit_total THEN
        RAISE EXCEPTION 'Application amount exceeds debit note total';
    END IF;

    -- Get AP account from credit note (credit side)
    SELECT account_id INTO v_ap_account_id
    FROM accounting.journal_lines
    WHERE journal_id = p_credit_note_id AND credit > 0
    LIMIT 1;

    -- Get AR account from debit note (debit side)
    SELECT account_id INTO v_ar_account_id
    FROM accounting.journal_lines
    WHERE journal_id = p_debit_note_id AND debit > 0
    LIMIT 1;

    v_application_reference := 'APP-' || v_credit_note.reference || '-TO-' || v_debit_note.reference;

    -- Create application journal (DR AP, CR AR)
    INSERT INTO accounting.journals (date, reference, description, created_by, payment_status)
    VALUES (
        p_applied_date,
        v_application_reference,
        'Application of ' || v_credit_note.reference || ' to ' || v_debit_note.reference,
        p_created_by,
        'n/a'
    )
    RETURNING id INTO v_application_journal_id;

    -- DR Accounts Payable
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_application_journal_id,
        v_ap_account_id,
        p_applied_date,
        p_amount,
        0,
        'Application of ' || v_credit_note.reference
    );

    -- CR Accounts Receivable
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_application_journal_id,
        v_ar_account_id,
        p_applied_date,
        0,
        p_amount,
        'Application to ' || v_debit_note.reference
    );

    -- Record application
    INSERT INTO accounting.note_applications (
        credit_note_id,
        debit_note_id,
        application_journal_id,
        amount,
        applied_date,
        created_by,
        notes
    ) VALUES (
        p_credit_note_id,
        p_debit_note_id,
        v_application_journal_id,
        p_amount,
        p_applied_date,
        p_created_by,
        p_notes
    );

    -- Update credit note paid amount (treating application as payment)
    UPDATE accounting.journals
    SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
        payment_status = CASE
            WHEN COALESCE(paid_amount, 0) + p_amount >= v_credit_total THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = p_credit_note_id;

    -- Update debit note paid amount
    UPDATE accounting.journals
    SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
        payment_status = CASE
            WHEN COALESCE(paid_amount, 0) + p_amount >= v_debit_total THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = p_debit_note_id;

    v_result := json_build_object(
        'success', true,
        'credit_note_id', p_credit_note_id,
        'debit_note_id', p_debit_note_id,
        'application_journal_id', v_application_journal_id,
        'amount', p_amount,
        'application_reference', v_application_reference
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark Refund Paid (for Credit Notes)
CREATE OR REPLACE FUNCTION accounting.fn_mark_refund_paid(
    p_journal_id INTEGER,
    p_bank_account_id INTEGER,
    p_payment_date DATE,
    p_created_by INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_note_record RECORD;
    v_payment_journal_id INTEGER;
    v_payment_reference TEXT;
    v_ap_account_id INTEGER;
    v_total_amount DECIMAL(15,2);
    v_result JSON;
BEGIN
    -- Get the note details
    SELECT * INTO v_note_record
    FROM accounting.journals
    WHERE id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal not found: %', p_journal_id;
    END IF;

    -- Check if credit note
    IF v_note_record.reference NOT LIKE 'CN-%' THEN
        RAISE EXCEPTION 'Only credit notes can have refunds marked as paid';
    END IF;

    -- Check if already paid
    IF v_note_record.payment_status IN ('paid', 'reconciled') THEN
        RAISE EXCEPTION 'Refund is already marked as paid';
    END IF;

    -- Check if voided
    IF v_note_record.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot mark voided note refund as paid';
    END IF;

    -- Calculate total amount from journal lines (credit side)
    SELECT COALESCE(SUM(credit), 0) INTO v_total_amount
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id AND credit > 0;

    -- Find AP account from original journal
    SELECT account_id INTO v_ap_account_id
    FROM accounting.journal_lines
    WHERE journal_id = p_journal_id AND credit > 0
    LIMIT 1;

    v_payment_reference := 'REF-' || v_note_record.reference;

    -- Create refund payment journal (DR AP, CR Cash/Bank)
    INSERT INTO accounting.journals (date, reference, description, created_by, payment_status)
    VALUES (
        p_payment_date,
        v_payment_reference,
        'Refund paid for ' || v_note_record.reference,
        p_created_by,
        'n/a'
    )
    RETURNING id INTO v_payment_journal_id;

    -- DR Accounts Payable
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_payment_journal_id,
        v_ap_account_id,
        p_payment_date,
        v_total_amount,
        0,
        'Refund for ' || v_note_record.reference
    );

    -- CR Cash/Bank
    INSERT INTO accounting.journal_lines (journal_id, account_id, date, debit, credit, memo)
    VALUES (
        v_payment_journal_id,
        p_bank_account_id,
        p_payment_date,
        0,
        v_total_amount,
        'Refund for ' || v_note_record.reference
    );

    -- Record payment
    INSERT INTO accounting.note_payments (
        journal_id,
        payment_journal_id,
        payment_type,
        amount,
        payment_date,
        bank_account_id,
        created_by,
        notes
    ) VALUES (
        p_journal_id,
        v_payment_journal_id,
        'refund',
        v_total_amount,
        p_payment_date,
        p_bank_account_id,
        p_created_by,
        p_notes
    );

    -- Update journal status
    UPDATE accounting.journals
    SET payment_status = 'paid',
        paid_amount = v_total_amount
    WHERE id = p_journal_id;

    v_result := json_build_object(
        'success', true,
        'journal_id', p_journal_id,
        'payment_journal_id', v_payment_journal_id,
        'amount', v_total_amount,
        'payment_reference', v_payment_reference
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Delete Journal (Hard Delete)
CREATE OR REPLACE FUNCTION accounting.fn_delete_journal(
    p_journal_id INTEGER,
    p_deleted_by INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_note_record RECORD;
    v_result JSON;
BEGIN
    -- Get the note details
    SELECT * INTO v_note_record
    FROM accounting.journals
    WHERE id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal not found: %', p_journal_id;
    END IF;

    -- Business rules: only allow deletion of unpaid, non-voided notes
    IF v_note_record.payment_status NOT IN ('unpaid', 'n/a') THEN
        RAISE EXCEPTION 'Cannot delete note with payment status: %', v_note_record.payment_status;
    END IF;

    IF v_note_record.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete voided note. Use void function instead.';
    END IF;

    -- Delete related records (CASCADE will handle note_payments and note_applications)
    -- Delete journal lines first
    DELETE FROM accounting.journal_lines WHERE journal_id = p_journal_id;

    -- Delete the journal
    DELETE FROM accounting.journals WHERE id = p_journal_id;

    v_result := json_build_object(
        'success', true,
        'journal_id', p_journal_id,
        'deleted_at', NOW(),
        'deleted_by', p_deleted_by
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON accounting.note_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON accounting.note_applications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE accounting.note_payments_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE accounting.note_applications_id_seq TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION accounting.fn_mark_note_paid TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_record_partial_payment TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_reconcile_payment TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_apply_credit_to_debit TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_mark_refund_paid TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_delete_journal TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
