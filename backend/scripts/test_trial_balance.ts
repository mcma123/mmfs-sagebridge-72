import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

async function testTrialBalance() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('Testing trial balance function...');
    console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    
    // Test 1: Check if function exists
    console.log('\n1. Checking if function exists...');
    const fnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'accounting'
        AND p.proname = 'fn_trial_balance_asof'
      ) as exists
    `);
    console.log('Function exists:', fnCheck.rows[0].exists);
    
    if (!fnCheck.rows[0].exists) {
      console.error('ERROR: Function accounting.fn_trial_balance_asof does not exist!');
      console.log('\nYou need to run migration 012_trial_balance_filters.sql');
      process.exit(1);
    }
    
    // Test 2: Call function with null (current date)
    console.log('\n2. Testing function with NULL (current date)...');
    try {
      const result1 = await pool.query('SELECT * FROM accounting.fn_trial_balance_asof($1::DATE)', [null]);
      console.log('Success! Rows returned:', result1.rows.length);
      if (result1.rows.length > 0) {
        console.log('Sample row:', result1.rows[0]);
      }
    } catch (err: any) {
      console.error('ERROR calling function with NULL:', err.message);
      console.error('Full error:', err);
    }
    
    // Test 3: Call function with specific date
    console.log('\n3. Testing function with date 2025-11-06...');
    try {
      const result2 = await pool.query('SELECT * FROM accounting.fn_trial_balance_asof($1::DATE)', ['2025-11-06']);
      console.log('Success! Rows returned:', result2.rows.length);
      if (result2.rows.length > 0) {
        console.log('Sample row:', result2.rows[0]);
      }
    } catch (err: any) {
      console.error('ERROR calling function with date:', err.message);
      console.error('Full error:', err);
    }
    
    // Test 4: Check if accounts table has data
    console.log('\n4. Checking accounts table...');
    const accountsCheck = await pool.query('SELECT COUNT(*) as count FROM accounting.accounts WHERE is_active = true');
    console.log('Active accounts:', accountsCheck.rows[0].count);
    
    // Test 5: Check if ledger_entries table has data
    console.log('\n5. Checking ledger_entries table...');
    const ledgerCheck = await pool.query('SELECT COUNT(*) as count FROM accounting.ledger_entries');
    console.log('Ledger entries:', ledgerCheck.rows[0].count);
    
  } catch (err: any) {
    console.error('Unexpected error:', err.message);
    console.error('Full error:', err);
  } finally {
    await pool.end();
  }
}

testTrialBalance();












