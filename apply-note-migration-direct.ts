import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

const sql = `
-- 031: Debit/Credit note reference sequences and generator
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
`;

async function applyMigration() {
    try {
        console.log('Applying migration via direct embedded SQL...');
        await pool.query(sql);
        console.log('Migration applied successfully!');

        // Test the function
        console.log('Testing function...');
        const result = await pool.query(
            "SELECT accounting.fn_next_note_reference('credit', CURRENT_DATE::date) AS ref"
        );
        console.log('SUCCESS: Function works! Reference:', result.rows[0].ref);
    } catch (e: any) {
        console.log('ERROR:', e.message);
        if (e.detail) console.log('Detail:', e.detail);
        if (e.hint) console.log('Hint:', e.hint);
    } finally {
        await pool.end();
    }
}

applyMigration();
