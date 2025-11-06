import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

console.log('\n=== Supabase Environment Check ===\n');

// Check environment variables
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment Variables:');
console.log('  SUPABASE_URL:', url ? `✓ ${url}` : '✗ NOT SET');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓ SET' : '✗ NOT SET');
console.log('  SUPABASE_ANON_KEY:', anonKey ? '✓ SET' : '✗ NOT SET');

if (!url) {
  console.error('\n❌ SUPABASE_URL is missing!');
  console.log('\nAdd to .env file:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  process.exit(1);
}

if (!serviceRoleKey && !anonKey) {
  console.error('\n❌ No Supabase key found!');
  console.log('\nAdd to .env file:');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.log('  OR');
  console.log('  SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

// Test connection
console.log('\n=== Testing Supabase Connection ===\n');

const key = serviceRoleKey || anonKey;
const client = createClient(url, key!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testConnection() {
  try {
    // Test 1: Check public.accounting_accounts view
    console.log('Test 1: Querying public.accounting_accounts...');
    const { data: accounts, error: accountsError } = await client
      .from('accounting_accounts')
      .select('id, code, name')
      .limit(1);

    if (accountsError) {
      console.error('  ❌ Error:', accountsError.message);
      console.log('\n  Possible causes:');
      console.log('    - View "public.accounting_accounts" does not exist');
      console.log('    - Supabase API "Exposed schemas" does not include "public"');
      console.log('    - Missing GRANTs on the view');
    } else {
      console.log('  ✓ Success! Found', accounts?.length || 0, 'account(s)');
      if (accounts && accounts.length > 0) {
        console.log('    Sample:', accounts[0]);
      }
    }

    // Test 2: Check public.accounting_ledger_entries view
    console.log('\nTest 2: Querying public.accounting_ledger_entries...');
    const { data: ledger, error: ledgerError } = await client
      .from('accounting_ledger_entries')
      .select('id, date')
      .limit(1);

    if (ledgerError) {
      console.error('  ❌ Error:', ledgerError.message);
      console.log('\n  Possible causes:');
      console.log('    - View "public.accounting_ledger_entries" does not exist');
      console.log('    - Supabase API "Exposed schemas" does not include "public"');
      console.log('    - Missing GRANTs on the view');
    } else {
      console.log('  ✓ Success! Found', ledger?.length || 0, 'entry(ies)');
    }

    // Test 3: Check public.accounting_journals view
    console.log('\nTest 3: Querying public.accounting_journals...');
    const { data: journals, error: journalsError } = await client
      .from('accounting_journals')
      .select('id, date')
      .limit(1);

    if (journalsError) {
      console.error('  ❌ Error:', journalsError.message);
      console.log('\n  Possible causes:');
      console.log('    - View "public.accounting_journals" does not exist');
      console.log('    - Supabase API "Exposed schemas" does not include "public"');
      console.log('    - Missing GRANTs on the view');
    } else {
      console.log('  ✓ Success! Found', journals?.length || 0, 'journal(s)');
    }

    console.log('\n=== Summary ===\n');
    
    const allPassed = !accountsError && !ledgerError && !journalsError;
    
    if (allPassed) {
      console.log('✓ All tests passed! Supabase connection is working correctly.');
    } else {
      console.log('❌ Some tests failed. Please check the errors above.');
      console.log('\nNext steps:');
      console.log('  1. Go to Supabase Dashboard → Settings → API');
      console.log('  2. Check "Exposed schemas" includes "public"');
      console.log('  3. Run migration: npm run db:migrate:app');
      console.log('  4. Verify views exist: SELECT * FROM public.accounting_accounts LIMIT 1;');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

testConnection();

