
import pg from 'pg';
const { Pool } = pg;

const baseConfig = {
    host: 'mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me',
    port: 6543,
    password: 'qykmdjoikvsxb22qeelp1jac6yqx0xes',
    database: 'postgres',
    ssl: false // Try without SSL first as per user config suggesting PGSSL=false
};

const candidates = [
    'postgres.your-tenant-id',
    'postgres.supabase-be5f',
    'postgres.postgres', // user.db
    'postgres' // Just to be sure 
];

async function testCandidate(username: string) {
    console.log(`Testing username: ${username}...`);
    const pool = new Pool({ ...baseConfig, user: username });
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`SUCCESS with ${username}:`, res.rows[0]);
        return true;
    } catch (err: any) {
        console.log(`FAILED with ${username}: ${err.message}`);
        return false;
    } finally {
        await pool.end();
    }
}

async function main() {
    for (const cand of candidates) {
        if (await testCandidate(cand)) {
            console.log('Found working configuration!');
            break;
        }
    }
}

main();
