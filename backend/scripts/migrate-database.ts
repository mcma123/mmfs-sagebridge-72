/**
 * Database Migration Script
 * Migrates all data from old Supabase instance to new Dokploy Supabase
 * 
 * Usage: npx tsx backend/scripts/migrate-database.ts
 */

// Allow self-signed certificates for both source and target connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { Pool } from 'pg';

// Old Supabase connection (source) - using session mode pooler
const SOURCE_CONFIG = {
  host: 'aws-0-ap-southeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.polssfuhfwecezntveha',
  password: 'P@ssword61157',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 30000,
};

// New Dokploy Supabase connection (target)
const TARGET_CONFIG = {
  host: 'mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me',
  port: 5432,
  user: 'postgres',
  password: 'qykmdjoikvsxb22qeelp1jac6yqx0xes',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 30000,
};

const sourcePool = new Pool(SOURCE_CONFIG);
const targetPool = new Pool(TARGET_CONFIG);

interface TableInfo {
  schema: string;
  table: string;
  fullName: string;
}

async function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function getTables(pool: Pool): Promise<TableInfo[]> {
  const result = await pool.query(`
    SELECT 
      table_schema as schema, 
      table_name as table,
      table_schema || '.' || table_name as "fullName"
    FROM information_schema.tables 
    WHERE table_type = 'BASE TABLE' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema', 'storage', 'vault', 'pgsodium', 'pgsodium_masks', 'realtime', 'extensions', 'graphql', 'graphql_public', 'supabase_functions', 'supabase_migrations', '_realtime', 'cron', 'net', 'pgbouncer')
    ORDER BY table_schema, table_name
  `);
  return result.rows;
}

async function getTableColumns(pool: Pool, schema: string, table: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);
  return result.rows.map(r => r.column_name);
}

async function getTableCount(pool: Pool, schema: string, table: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${schema}"."${table}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    return 0;
  }
}

async function disableForeignKeys(pool: Pool) {
  await pool.query('SET session_replication_role = replica;');
  log('Foreign key checks disabled');
}

async function enableForeignKeys(pool: Pool) {
  await pool.query('SET session_replication_role = DEFAULT;');
  log('Foreign key checks re-enabled');
}

async function createSchemasIfNeeded(targetPool: Pool, schemas: string[]) {
  const uniqueSchemas = [...new Set(schemas)].filter(s => s !== 'public');
  for (const schema of uniqueSchemas) {
    try {
      await targetPool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      log(`Schema "${schema}" ensured`);
    } catch (err: any) {
      log(`Warning: Could not create schema "${schema}": ${err.message}`);
    }
  }
}

async function exportTableSchema(sourcePool: Pool, schema: string, table: string): Promise<string | null> {
  // Get column definitions
  const columnsResult = await sourcePool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);

  if (columnsResult.rows.length === 0) return null;

  const columns = columnsResult.rows.map(col => {
    let type = col.data_type;
    if (col.data_type === 'character varying' && col.character_maximum_length) {
      type = `varchar(${col.character_maximum_length})`;
    } else if (col.data_type === 'ARRAY') {
      type = col.udt_name.replace(/^_/, '') + '[]';
    } else if (col.data_type === 'USER-DEFINED') {
      type = col.udt_name;
    }

    const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
    const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    return `  "${col.column_name}" ${type}${nullable}${defaultVal}`;
  });

  // Get primary key
  const pkResult = await sourcePool.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY kcu.ordinal_position
  `, [schema, table]);

  let pkConstraint = '';
  if (pkResult.rows.length > 0) {
    const pkColumns = pkResult.rows.map(r => `"${r.column_name}"`).join(', ');
    pkConstraint = `,\n  PRIMARY KEY (${pkColumns})`;
  }

  return `CREATE TABLE IF NOT EXISTS "${schema}"."${table}" (\n${columns.join(',\n')}${pkConstraint}\n);`;
}

async function migrateTable(
  sourcePool: Pool,
  targetPool: Pool,
  schema: string,
  table: string,
  batchSize: number = 1000
): Promise<{ success: boolean; rowCount: number; error?: string }> {
  const fullName = `${schema}.${table}`;

  try {
    // Get source row count
    const sourceCount = await getTableCount(sourcePool, schema, table);
    if (sourceCount === 0) {
      log(`  [${fullName}] Empty table, skipping data migration`);
      return { success: true, rowCount: 0 };
    }

    // Get columns
    const columns = await getTableColumns(sourcePool, schema, table);
    if (columns.length === 0) {
      log(`  [${fullName}] No columns found, skipping`);
      return { success: true, rowCount: 0 };
    }

    const columnList = columns.map(c => `"${c}"`).join(', ');

    // Clear target table first
    await targetPool.query(`DELETE FROM "${schema}"."${table}"`);

    // Fetch all data from source
    const selectQuery = `SELECT ${columnList} FROM "${schema}"."${table}"`;
    const sourceData = await sourcePool.query(selectQuery);

    if (sourceData.rows.length === 0) {
      return { success: true, rowCount: 0 };
    }

    // Insert in batches
    let insertedCount = 0;
    for (let i = 0; i < sourceData.rows.length; i += batchSize) {
      const batch = sourceData.rows.slice(i, i + batchSize);

      // Build INSERT statement with multiple value sets
      const placeholders = batch.map((_, rowIdx) => {
        const rowPlaceholders = columns.map((_, colIdx) =>
          `$${rowIdx * columns.length + colIdx + 1}`
        );
        return `(${rowPlaceholders.join(', ')})`;
      }).join(',\n');

      const values = batch.flatMap(row => columns.map(col => row[col]));

      const insertQuery = `
        INSERT INTO "${schema}"."${table}" (${columnList})
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
      `;

      await targetPool.query(insertQuery, values);
      insertedCount += batch.length;

      if (batch.length === batchSize) {
        log(`  [${fullName}] Inserted ${insertedCount}/${sourceData.rows.length} rows...`);
      }
    }

    log(`  [${fullName}] ✓ Migrated ${insertedCount} rows`);
    return { success: true, rowCount: insertedCount };

  } catch (err: any) {
    log(`  [${fullName}] ✗ Error: ${err.message}`);
    return { success: false, rowCount: 0, error: err.message };
  }
}

async function resetSequences(pool: Pool, schema: string, table: string) {
  try {
    // Find sequences for this table
    const seqResult = await pool.query(`
      SELECT 
        column_name,
        pg_get_serial_sequence('"${schema}"."${table}"', column_name) as seq_name
      FROM information_schema.columns
      WHERE table_schema = $1 
        AND table_name = $2
        AND column_default LIKE 'nextval%'
    `, [schema, table]);

    for (const row of seqResult.rows) {
      if (row.seq_name) {
        await pool.query(`
          SELECT setval('${row.seq_name}', COALESCE((SELECT MAX("${row.column_name}") FROM "${schema}"."${table}"), 1), true)
        `);
        log(`  Reset sequence ${row.seq_name}`);
      }
    }
  } catch (err: any) {
    // Ignore sequence errors
  }
}

async function runMigration() {
  log('='.repeat(60));
  log('DATABASE MIGRATION STARTED');
  log('='.repeat(60));
  log('');
  log('Source: Old Supabase (polssfuhfwecezntveha.supabase.co)');
  log('Target: New Dokploy Supabase (mmfs-pre0225supabase-6929f4-147-79-100-232.traefik.me)');
  log('');

  try {
    // Test connections
    log('Testing source connection...');
    await sourcePool.query('SELECT 1');
    log('✓ Source connection successful');

    log('Testing target connection...');
    await targetPool.query('SELECT 1');
    log('✓ Target connection successful');
    log('');

    // Get all tables from source
    log('Discovering tables in source database...');
    const tables = await getTables(sourcePool);
    log(`Found ${tables.length} tables across schemas`);
    log('');

    if (tables.length === 0) {
      log('No tables found to migrate!');
      return;
    }

    // Group tables by schema
    const schemas = [...new Set(tables.map(t => t.schema))];
    log(`Schemas found: ${schemas.join(', ')}`);
    log('');

    // Create schemas in target
    log('Creating schemas in target database...');
    await createSchemasIfNeeded(targetPool, schemas);
    log('');

    // Create tables in target (schema first)
    log('Creating table schemas in target database...');
    for (const { schema, table, fullName } of tables) {
      try {
        const createSQL = await exportTableSchema(sourcePool, schema, table);
        if (createSQL) {
          await targetPool.query(createSQL);
          log(`  Created table: ${fullName}`);
        }
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          log(`  Warning creating ${fullName}: ${err.message}`);
        }
      }
    }
    log('');

    // Disable foreign key checks for data migration
    log('Disabling foreign key constraints...');
    await disableForeignKeys(targetPool);
    log('');

    // Migrate data for each table
    log('Migrating table data...');
    log('-'.repeat(60));

    const results: { table: string; success: boolean; rows: number; error?: string }[] = [];

    for (const { schema, table, fullName } of tables) {
      const result = await migrateTable(sourcePool, targetPool, schema, table);
      results.push({
        table: fullName,
        success: result.success,
        rows: result.rowCount,
        error: result.error
      });
    }

    log('');
    log('-'.repeat(60));

    // Re-enable foreign keys
    log('Re-enabling foreign key constraints...');
    await enableForeignKeys(targetPool);
    log('');

    // Reset sequences
    log('Resetting sequences...');
    for (const { schema, table } of tables) {
      await resetSequences(targetPool, schema, table);
    }
    log('');

    // Summary
    log('='.repeat(60));
    log('MIGRATION SUMMARY');
    log('='.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalRows = successful.reduce((sum, r) => sum + r.rows, 0);

    log(`Tables migrated: ${successful.length}/${results.length}`);
    log(`Total rows migrated: ${totalRows}`);

    if (failed.length > 0) {
      log('');
      log('Failed tables:');
      for (const f of failed) {
        log(`  - ${f.table}: ${f.error}`);
      }
    }

    log('');
    log('✓ Migration completed!');

  } catch (err: any) {
    log(`FATAL ERROR: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
