/**
 * Run All Migrations Script
 * Creates all database tables and schemas in the new Dokploy Supabase instance
 * 
 * Usage: npx tsx backend/scripts/run-all-migrations.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get connection from environment
const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
    // No SSL for self-hosted Supabase
});

async function log(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

async function runMigrations() {
    log('='.repeat(60));
    log('RUNNING DATABASE MIGRATIONS');
    log('='.repeat(60));
    log('');
    log(`Host: ${process.env.PGHOST}`);
    log(`Port: ${process.env.PGPORT}`);
    log(`User: ${process.env.PGUSER}`);
    log(`Database: ${process.env.PGDATABASE}`);
    log('');

    try {
        // Test connection
        log('Testing database connection...');
        const versionResult = await pool.query('SELECT version()');
        log(`✓ Connected to: ${versionResult.rows[0].version.split(',')[0]}`);
        log('');

        // Get all SQL migration files in order
        const migrationsDir = path.join(__dirname, '..', 'migrations', 'sql');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        log(`Found ${files.length} migration files`);
        log('-'.repeat(60));

        let successCount = 0;
        let failCount = 0;
        const errors: { file: string; error: string }[] = [];

        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await pool.query(sql);
                log(`✓ ${file}`);
                successCount++;
            } catch (err: any) {
                // Check if it's a "already exists" error, which is OK
                if (err.message.includes('already exists') ||
                    err.message.includes('duplicate key') ||
                    err.message.includes('already defined')) {
                    log(`⊘ ${file} (already applied)`);
                    successCount++;
                } else {
                    log(`✗ ${file}: ${err.message}`);
                    errors.push({ file, error: err.message });
                    failCount++;
                }
            }
        }

        log('');
        log('-'.repeat(60));
        log('MIGRATION SUMMARY');
        log('-'.repeat(60));
        log(`Successful: ${successCount}`);
        log(`Failed: ${failCount}`);

        if (errors.length > 0) {
            log('');
            log('Errors:');
            for (const e of errors) {
                log(`  ${e.file}: ${e.error}`);
            }
        }

        log('');
        log('✓ Migrations complete!');

    } catch (err: any) {
        log(`FATAL ERROR: ${err.message}`);
        console.error(err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations().catch(console.error);
