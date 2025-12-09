-- 031: Debit/Credit note reference sequences and generator
-- Ensures DN- and CN- references are generated from global sequences.

-- Create sequences for debit and credit notes
CREATE SEQUENCE IF NOT EXISTS accounting.seq_debit_note_number;
CREATE SEQUENCE IF NOT EXISTS accounting.seq_credit_note_number;

-- Initialise sequences from existing journal references
DO $$
DECLARE
  v_max_debit  BIGINT;
  v_max_credit BIGINT;
BEGIN
  -- Highest numeric suffix for DN-YYYY-XXXXXX
  SELECT
    MAX(
      ((regexp_match(reference, '^DN-[0-9]{4}-([0-9]+)'))[1])::BIGINT
    )
  INTO v_max_debit
  FROM accounting.journals
  WHERE reference LIKE 'DN-%';

  IF v_max_debit IS NULL THEN
    v_max_debit := 0;
  END IF;

  PERFORM setval('accounting.seq_debit_note_number', v_max_debit, true);

  -- Highest numeric suffix for CN-YYYY-XXXXXX
  SELECT
    MAX(
      ((regexp_match(reference, '^CN-[0-9]{4}-([0-9]+)'))[1])::BIGINT
    )
  INTO v_max_credit
  FROM accounting.journals
  WHERE reference LIKE 'CN-%';

  IF v_max_credit IS NULL THEN
    v_max_credit := 0;
  END IF;

  PERFORM setval('accounting.seq_credit_note_number', v_max_credit, true);
END;
$$;

-- Function: Generate next debit/credit note reference
CREATE OR REPLACE FUNCTION accounting.fn_next_note_reference(
  p_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq    BIGINT;
  v_year   TEXT;
  v_prefix TEXT;
BEGIN
  IF p_type = 'debit' THEN
    v_prefix := 'DN';
    v_seq := nextval('accounting.seq_debit_note_number');
  ELSIF p_type = 'credit' THEN
    v_prefix := 'CN';
    v_seq := nextval('accounting.seq_credit_note_number');
  ELSE
    RAISE EXCEPTION 'Invalid note type %, expected ''debit'' or ''credit''', p_type;
  END IF;

  v_year := to_char(p_date, 'YYYY');
  RETURN format('%s-%s-%06s', v_prefix, v_year, v_seq);
END;
$$;

-- Grants
GRANT USAGE, SELECT ON SEQUENCE accounting.seq_debit_note_number TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE accounting.seq_credit_note_number TO authenticated;
GRANT EXECUTE ON FUNCTION accounting.fn_next_note_reference(TEXT, DATE) TO authenticated;

-- Migration complete