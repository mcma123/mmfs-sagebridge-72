
import pg from 'pg';
const { Pool } = pg;

const config = {
    host: 'mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me',
    port: 6543,
    user: 'postgres',
    password: 'qykmdjoikvsxb22qeelp1jac6yqx0xes',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

import fs from 'fs';

function log(msg: string) {
    fs.appendFileSync('test-db.log', msg + '\n');
    console.log(msg);
}

async function test(port: number, useSsl: boolean = true) {
    log(`Testing connection on port ${port} (SSL: ${useSsl})...`);
    const sslConfig = useSsl ? { rejectUnauthorized: false } : false;
    const pool = new Pool({ ...config, port, ssl: sslConfig as any });
    try {
        const res = await pool.query('SELECT NOW()');
        log(`Success on port ${port}: ${JSON.stringify(res.rows[0])}`);
    } catch (err: any) {
        log(`Error on port ${port}: ${err.message}`);
    } finally {
        await pool.end();
    }
}

async function main() {
    fs.writeFileSync('test-db.log', '');
    await test(5432, false); // Try no SSL on 5432
    await test(6543, true);  // Try SSL on 6543
}

main();
