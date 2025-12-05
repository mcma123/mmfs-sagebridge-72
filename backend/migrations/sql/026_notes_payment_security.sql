-- =====================================================
-- 026: Secure note payment and allocation functions
--      by running them as SECURITY DEFINER
--      and constraining search_path.
-- =====================================================

-- Mark note as paid
ALTER FUNCTION accounting.fn_mark_note_paid(
  INTEGER,  -- p_journal_id
  INTEGER,  -- p_bank_account_id
  DATE,     -- p_payment_date
  INTEGER,  -- p_created_by
  TEXT      -- p_notes
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_mark_note_paid(
  INTEGER, INTEGER, DATE, INTEGER, TEXT
) SET search_path = accounting, public;

-- Record partial payment
ALTER FUNCTION accounting.fn_record_partial_payment(
  INTEGER,  -- p_journal_id
  NUMERIC,  -- p_amount (DECIMAL(15,2))
  INTEGER,  -- p_bank_account_id
  DATE,     -- p_payment_date
  INTEGER,  -- p_created_by
  TEXT      -- p_notes
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_record_partial_payment(
  INTEGER, NUMERIC, INTEGER, DATE, INTEGER, TEXT
) SET search_path = accounting, public;

-- Reconcile payment
ALTER FUNCTION accounting.fn_reconcile_payment(
  INTEGER,  -- p_journal_id
  INTEGER   -- p_created_by
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_reconcile_payment(
  INTEGER, INTEGER
) SET search_path = accounting, public;

-- Apply credit note to debit note
ALTER FUNCTION accounting.fn_apply_credit_to_debit(
  INTEGER,  -- p_credit_note_id
  INTEGER,  -- p_debit_note_id
  NUMERIC,  -- p_amount
  DATE,     -- p_applied_date
  INTEGER,  -- p_created_by
  TEXT      -- p_notes
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_apply_credit_to_debit(
  INTEGER, INTEGER, NUMERIC, DATE, INTEGER, TEXT
) SET search_path = accounting, public;

-- Mark refund paid (credit note)
ALTER FUNCTION accounting.fn_mark_refund_paid(
  INTEGER,  -- p_journal_id
  INTEGER,  -- p_bank_account_id
  DATE,     -- p_payment_date
  INTEGER,  -- p_created_by
  TEXT      -- p_notes
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_mark_refund_paid(
  INTEGER, INTEGER, DATE, INTEGER, TEXT
) SET search_path = accounting, public;

-- Hard delete journal (used for unpaid notes, drafts)
ALTER FUNCTION accounting.fn_delete_journal(
  INTEGER,  -- p_journal_id
  INTEGER   -- p_deleted_by
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_delete_journal(
  INTEGER, INTEGER
) SET search_path = accounting, public;

-- Finalise debit note income
ALTER FUNCTION accounting.fn_finalize_debit_note(
  INTEGER,  -- p_debit_note_id
  INTEGER,  -- p_mmfs_income_account_id
  INTEGER,  -- p_balancing_account_id
  INTEGER,  -- p_created_by
  TEXT      -- p_notes
) SECURITY DEFINER;

ALTER FUNCTION accounting.fn_finalize_debit_note(
  INTEGER, INTEGER, INTEGER, INTEGER, TEXT
) SET search_path = accounting, public;

-- =====================================================
-- END 026_notes_payment_security
-- =====================================================