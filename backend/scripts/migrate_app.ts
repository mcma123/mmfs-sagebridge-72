import 'dotenv/config';
// Disable TLS cert verification for migration script to work with Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
  const sslRequired =
    (typeof process.env.PGSSL === 'string' && process.env.PGSSL.toLowerCase() === 'true') ||
    (connectionString && /sslmode=require/i.test(connectionString));

  if (connectionString) {
    // Force SSL for Supabase; ignore self-signed certs
    return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }

  const host = process.env.PGHOST || process.env.DB_HOST || process.env.SUPABASE_DB_HOST;
  const port = Number(process.env.PGPORT || process.env.DB_PORT || process.env.SUPABASE_DB_PORT || 5432);
  const user = process.env.PGUSER || process.env.DB_USER || process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.PGDATABASE || process.env.DB_NAME || process.env.SUPABASE_DB_NAME || 'postgres';

  if (!host || !password) {
    throw new Error('Postgres env missing: PGHOST/DB_HOST/SUPABASE_DB_HOST, PGPASSWORD/DB_PASSWORD/SUPABASE_DB_PASSWORD');
  }
  // Force SSL for Supabase; ignore self-signed certs
  return new Pool({ host, port, user, password, database, ssl: { rejectUnauthorized: false } });
}

async function run() {
  const pool = getPool();
  const sqlDir = path.resolve(process.cwd(), 'backend', 'migrations', 'sql');
  const filesToRun = [
    '005_app_init.sql',
    '006_app_seed_admin.sql',
    '007_accounting_init.sql',
    '008_accounting_seed.sql',
    '009_accounting_api_views.sql',
    '010_accounting_actions.sql',
    '011_journal_workflow.sql',
    '012_trial_balance_filters.sql',
  ];
  console.log('[migrate_app] Running files:', filesToRun.join(', '));
  for (const fname of filesToRun) {
    const fpath = path.join(sqlDir, fname);
    const sql = fs.readFileSync(fpath, 'utf8');
    console.log(`[migrate_app] Executing ${fname} (${sql.length} bytes)`);
    await pool.query(sql);
    console.log(`[migrate_app] Completed ${fname}`);
  }
  await pool.end();
  console.log('[migrate_app] Done');
}

run().catch((err) => {
  console.error('[migrate_app] ERROR', err);
  process.exit(1);
});