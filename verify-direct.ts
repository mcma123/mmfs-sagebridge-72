
import { Pool } from 'pg';

const host = 'mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me';
const password = 'qykmdjoikvsxb22qeelp1jac6yqx0xes';

const variants = [
    { user: 'postgres', port: 5432 },
    { user: 'postgres.postgres', port: 5432 },
    { user: 'postgres.postgres', port: 6543 },
    { user: 'postgres.default', port: 5432 },
    { user: 'postgres.default', port: 6543 },
    // Try extracting ID from host? 
    // Host is mmfs-... .traefik.me. 
    // Maybe tenant is 'mmfs-pre0225supabase-6929f4'? It's long.
];

async function test() {
    for (const v of variants) {
        console.log(`\nTesting User: ${v.user}, Port: ${v.port}`);
        const pool = new Pool({
            host,
            port: v.port,
            user: v.user,
            password,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }, // Try with SSL enabled as Supavisor usually wants it
            connectionTimeoutMillis: 3000
        });

        try {
            const client = await pool.connect();
            console.log('  SUCCESS!');
            client.release();
            await pool.end();
            process.exit(0);
        } catch (err: any) {
            console.log(`  Failed: ${err.message}`);
        }
        await pool.end();
    }
    console.log('All variants failed.');
}

test();
