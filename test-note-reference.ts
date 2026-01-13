import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function testFunction() {
    try {
        // Test the fn_next_note_reference function
        const result = await pool.query(
            "SELECT accounting.fn_next_note_reference('credit', CURRENT_DATE::date) AS ref"
        );
        console.log('SUCCESS: Function works! Reference:', result.rows[0].ref);
    } catch (e: any) {
        console.log('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}

testFunction();
