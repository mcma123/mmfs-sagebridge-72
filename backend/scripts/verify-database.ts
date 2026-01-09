/**
 * Verify Database Schema Script
 * Lists all tables created and enables required extensions
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function verify() {
    console.log('='.repeat(60));
    console.log('DATABASE VERIFICATION');
    console.log('='.repeat(60));

    try {
        // Enable pg_trgm extension
        console.log('\nEnabling pg_trgm extension...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        console.log('✓ pg_trgm extension enabled');

        // List all schemas
        console.log('\nSchemas:');
        const schemas = await pool.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
        schemas.rows.forEach(r => console.log('  - ' + r.schema_name));

        // List all tables by schema
        console.log('\nTables by schema:');
        const tables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' 
        AND table_schema IN ('app', 'accounting', 'banking', 'dms', 'public', 'auth')
      ORDER BY table_schema, table_name
    `);

        let currentSchema = '';
        tables.rows.forEach(r => {
            if (r.table_schema !== currentSchema) {
                currentSchema = r.table_schema;
                console.log(`\n  [${currentSchema}]`);
            }
            console.log(`    - ${r.table_name}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log(`Total: ${tables.rows.length} tables`);
        console.log('='.repeat(60));

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

verify();
