
import pg from 'pg';
const { Pool } = pg;

const config = {
    connectionString: 'postgresql://postgres.your-tenant-id:qykmdjoikvsxb22qeelp1jac6yqx0xes@mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me:6543/postgres?sslmode=disable'
};

async function checkFunction() {
    const pool = new Pool(config);
    try {
        const res = await pool.query(`
            SELECT n.nspname, p.proname, p.oid, pg_get_function_identity_arguments(p.oid) as args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'fn_create_account';
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkFunction();
