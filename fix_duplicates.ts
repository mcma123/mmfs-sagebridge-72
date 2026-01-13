
import pg from 'pg';
const { Pool } = pg;

const config = {
    connectionString: 'postgresql://postgres.your-tenant-id:qykmdjoikvsxb22qeelp1jac6yqx0xes@mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me:6543/postgres?sslmode=disable'
};

async function fixDuplicates() {
    const pool = new Pool(config);
    try {
        // Find all functions with name fn_create_tax_return in public schema
        const res = await pool.query(`
            SELECT 'DROP FUNCTION IF EXISTS ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ');' as drop_sql
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'fn_create_tax_return' AND n.nspname = 'public';
        `);

        console.log(`Found ${res.rows.length} functions to drop.`);

        for (const row of res.rows) {
            console.log(`Executing: ${row.drop_sql}`);
            await pool.query(row.drop_sql);
        }
        console.log('Done.');

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fixDuplicates();
