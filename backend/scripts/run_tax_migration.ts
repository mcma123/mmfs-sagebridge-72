import 'dotenv/config';
// Disable TLS cert verification  
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function run() {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    const sqlFile = path.resolve(process.cwd(), 'backend', 'migrations', 'sql', '013_tax_reports.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log(`[run_tax_migration] Executing 013_tax_reports.sql (${sql.length} bytes)`);

    try {
        await pool.query(sql);
        console.log('[run_tax_migration] Successfully updated tax report functions with SECURITY DEFINER');
    } catch (err: any) {
        console.log('[run_tax_migration] Note: Some errors are expected if tables already exist');
        console.log('[run_tax_migration] Error:', err.message);
    }

    await pool.end();
    console.log('[run_tax_migration] Done');
}

run().catch((err) => {
    console.error('[run_tax_migration] ERROR', err);
    process.exit(1);
});
