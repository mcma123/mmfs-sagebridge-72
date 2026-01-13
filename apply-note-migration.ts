import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function applyMigration() {
    try {
        console.log('Reading migration file...');
        const migrationPath = path.join(__dirname, 'backend', 'migrations', 'sql', '031_note_reference_sequences.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Applying migration...');
        console.log('SQL to execute:');
        console.log(sql);
        console.log('\n---\n');

        await pool.query(sql);
        console.log('Migration applied successfully!');

        // Test the function
        console.log('\nTesting function...');
        const result = await pool.query(
            "SELECT accounting.fn_next_note_reference('credit', CURRENT_DATE::date) AS ref"
        );
        console.log('SUCCESS: Function works! Reference:', result.rows[0].ref);
    } catch (e: any) {
        console.log('ERROR:', e.message);
        console.log('Full error:', e);
    } finally {
        await pool.end();
    }
}

applyMigration();
