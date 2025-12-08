-- 028: Fix payment reconciliation views for debit and credit notes
-- This migration corrects journal status case and exposes note_type for both
-- debit notes (receivables) and credit notes (refunds/credits).

-- =====================================================================
-- 1. Outstanding Receivables View (Debit Notes)
-- =====================================================================

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
      AND j.status = 'posted'
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
    END AS aging_bucket,
    'debit_note'::text AS note_type
FROM journal_totals jt
LEFT JOIN accounting.entities e ON jt.entity_id = e.id
WHERE (jt.total_debit - COALESCE(jt.paid_amount, 0)) > 0.01
ORDER BY jt.journal_date ASC;

COMMENT ON VIEW accounting.vw_outstanding_receivables IS
  'All unpaid or partially paid debit notes with amounts due (receivables).';

-- =====================================================================
-- 2. Available Credit Notes View
-- =====================================================================

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
      AND j.status = 'posted'
      AND j.payment_status IN ('unpaid', 'partial')
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
    jt.payment_status,
    (CURRENT_DATE - jt.journal_date) AS days_outstanding,
    CASE
        WHEN CURRENT_DATE - jt.journal_date <= 30 THEN '0-30'
        WHEN CURRENT_DATE - jt.journal_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - jt.journal_date <= 90 THEN '61-90'
        ELSE '90+'
    END AS aging_bucket,
    'credit_note'::text AS note_type
FROM journal_totals jt
LEFT JOIN accounting.entities e ON jt.entity_id = e.id
WHERE (jt.total_credit - COALESCE(jt.paid_amount, 0)) > 0.01
ORDER BY jt.journal_date ASC;

COMMENT ON VIEW accounting.vw_available_credits IS
  'Credit notes with remaining available amount (not fully applied or refunded).';

-- =====================================================================
-- 3. Grants
-- =====================================================================

GRANT SELECT ON accounting.vw_outstanding_receivables TO authenticated;
GRANT SELECT ON accounting.vw_available_credits TO authenticated;

-- =====================================================================
-- Migration complete