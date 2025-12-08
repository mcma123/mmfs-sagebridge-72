-- Migration 030: Relax journal_lines_amount_check to allow zero-amount lines
-- Safely redefines the constraint so debit/credit are non-negative,
-- and a line cannot have both debit and credit positive,
-- but zero/zero lines are allowed (needed for zero-share notes).

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'journal_lines_amount_check'
      AND n.nspname = 'accounting'
      AND t.relname = 'journal_lines'
  ) THEN
    ALTER TABLE accounting.journal_lines
      DROP CONSTRAINT journal_lines_amount_check;
  END IF;
END $$;

ALTER TABLE accounting.journal_lines
  ADD CONSTRAINT journal_lines_amount_check
  CHECK (
    debit >= 0
    AND credit >= 0
    AND NOT (debit > 0 AND credit > 0)
  );

-- Migration complete