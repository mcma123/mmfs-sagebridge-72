import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Supabase Connection Fix - Diagnostic & Setup Tool      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Step 1: Check current environment
  console.log('📋 Step 1: Checking current environment...\n');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  console.log('Environment Variables Status:');
  console.log(`  SUPABASE_URL: ${url ? '✓ SET' : '✗ MISSING'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✓ SET' : '✗ MISSING'}`);
  console.log(`  SUPABASE_ANON_KEY: ${anonKey ? '✓ SET' : '✗ MISSING'}`);
  console.log(`  DATABASE_URL: ${dbUrl ? '✓ SET' : '✗ MISSING'}\n');

  // Step 2: Test PostgreSQL connection (explain why Trial Balance works)
  if (dbUrl) {
    console.log('📊 Step 2: Testing PostgreSQL connection (Trial Balance path)...\n');
    try {
      const pool = new Pool({ connectionString: dbUrl });
      const result = await pool.query('SELECT 1 as test');
      console.log('  ✓ PostgreSQL connection works!');
      console.log('  ℹ️  This is why Trial Balance page still works.\n');
      await pool.end();
    } catch (err: any) {
      console.log('  ✗ PostgreSQL connection failed:', err.message, '\n');
    }
  } else {
    console.log('📊 Step 2: PostgreSQL connection...\n');
    console.log('  ⚠️  DATABASE_URL not set, but Trial Balance works,');
    console.log('     so DB connection must be configured elsewhere.\n');
  }

  // Step 3: Identify the problem
  console.log('🔍 Step 3: Root Cause Analysis\n');

  if (!url || (!serviceRoleKey && !anonKey)) {
    console.log('  ❌ PROBLEM IDENTIFIED:');
    console.log('     Supabase environment variables are MISSING!\n');
    console.log('  📝 What this means:');
    console.log('     - Endpoints using req.db (Supabase client) fail → 500 errors');
    console.log('     - Affected pages: Journals, Chart of Accounts, General Ledger');
    console.log('     - Trial Balance works because it uses req.pg (direct PostgreSQL)\n');

    console.log('  💡 Solution:');
    console.log('     Add Supabase credentials to .env file\n');

    // Offer to create .env file
    const createEnv = await question('Would you like to add Supabase credentials now? (y/n): ');

    if (createEnv.toLowerCase() === 'y') {
      console.log('\n📝 Please provide your Supabase credentials:');
      console.log('   (Find these at: Supabase Dashboard → Settings → API)\n');

      const supabaseUrl = await question('Supabase URL (e.g., https://xxx.supabase.co): ');
      const supabaseServiceKey = await question('Service Role Key: ');
      const supabaseAnonKey = await question('Anon Key (optional, press Enter to skip): ');

      console.log('\n✍️  Creating/updating .env file...');

      const fs = await import('fs');
      const path = await import('path');

      const envPath = path.join(process.cwd(), '..', '.env');
      let envContent = '';

      // Read existing .env if it exists
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Update or add Supabase variables
      const updates: Record<string, string> = {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
        VITE_SUPABASE_URL: supabaseUrl,
      };

      if (supabaseAnonKey) {
        updates.SUPABASE_ANON_KEY = supabaseAnonKey;
        updates.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;
      }

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('  ✓ .env file updated!\n');

      // Test the new connection
      console.log('🧪 Step 4: Testing Supabase connection...\n');

      const client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      try {
        const { data, error } = await client
          .from('accounting_accounts')
          .select('id')
          .limit(1);

        if (error) {
          console.log('  ⚠️  Connection works, but query failed:', error.message);
          console.log('\n  Possible causes:');
          console.log('    1. Supabase API "Exposed schemas" does not include "public"');
          console.log('    2. View "public.accounting_accounts" does not exist');
          console.log('    3. Missing GRANTs on the view\n');
          console.log('  📖 See ENV_SETUP_GUIDE.md for detailed troubleshooting steps.');
        } else {
          console.log('  ✓ Supabase connection successful!');
          console.log('  ✓ Query to accounting_accounts works!');
          console.log('\n  🎉 All systems operational!\n');
          console.log('  Next steps:');
          console.log('    1. Restart your backend server');
          console.log('    2. Test the accounting pages in your browser');
        }
      } catch (err: any) {
        console.log('  ✗ Connection test failed:', err.message);
      }
    } else {
      console.log('\n📖 Please refer to ENV_SETUP_GUIDE.md for manual setup instructions.');
    }
  } else {
    console.log('  ✓ Supabase environment variables are set!');
    console.log('\n🧪 Step 4: Testing Supabase connection...\n');

    const key = serviceRoleKey || anonKey;
    const client = createClient(url, key!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
      const { data, error } = await client
        .from('accounting_accounts')
        .select('id')
        .limit(1);

      if (error) {
        console.log('  ⚠️  Environment is set, but query failed:', error.message);
        console.log('\n  Possible causes:');
        console.log('    1. Supabase API "Exposed schemas" does not include "public"');
        console.log('    2. View "public.accounting_accounts" does not exist');
        console.log('    3. Missing GRANTs on the view\n');
        console.log('  📖 See ENV_SETUP_GUIDE.md for detailed troubleshooting steps.');
      } else {
        console.log('  ✓ Everything looks good!');
        console.log('\n  If you\'re still seeing errors:');
        console.log('    1. Restart your backend server');
        console.log('    2. Check browser console for specific error messages');
        console.log('    3. Verify Supabase "Exposed schemas" includes "public"');
      }
    } catch (err: any) {
      console.log('  ✗ Connection test failed:', err.message);
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    Diagnostic Complete                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  rl.close();
}

main().catch(console.error);

