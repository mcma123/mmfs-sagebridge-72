import 'dotenv/config';
import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  // Prefer SUPABASE_DB_URL over DATABASE_URL to align with deployment configuration
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';

  // Basic debug to know which source is in use (no secrets logged)
  try {
    const src = process.env.SUPABASE_DB_URL
      ? 'SUPABASE_DB_URL'
      : process.env.DATABASE_URL
      ? 'DATABASE_URL'
      : 'DISCRETE_VARS';
    console.log(`[pg] Using ${src} for Postgres connection`);
  } catch (_) {
    // ignore logging errors
  }

  // Determine SSL config (Supabase requires SSL; local dev usually not)
  const sslRequired =
    (typeof process.env.PGSSL === 'string' && process.env.PGSSL.toLowerCase() === 'true') ||
    (connectionString && /sslmode=require/i.test(connectionString));

  if (sslRequired && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    // Relax TLS verification in dev to avoid self-signed cert errors when connecting to Supabase
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  if (connectionString) {
    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
      // Production-ready pool configuration for Supabase
      max: 20,                            // Maximum pool size (increased from default 10)
      idleTimeoutMillis: 30000,           // 30s idle timeout (matches Supabase pooler)
      connectionTimeoutMillis: 10000,     // 10s connection timeout (prevent hanging)
      keepAlive: true,                    // Enable TCP keepalive
      keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
    });

    // Add error handler to prevent pool crashes
    pool.on('error', (err: Error) => {
      console.error('[pg] Unexpected pool error on idle client:', err);
      // Pool will automatically remove bad client, no action needed
    });

    pool.on('connect', () => {
      console.log('[pg] New client connected to pool');
    });

    console.log('[pg] ✓ PostgreSQL pool created with production configuration');
    return pool;
  }

  const host = process.env.PGHOST || process.env.DB_HOST || process.env.SUPABASE_DB_HOST;
  const port = Number(process.env.PGPORT || process.env.DB_PORT || process.env.SUPABASE_DB_PORT || 5432);
  const user = process.env.PGUSER || process.env.DB_USER || process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.PGDATABASE || process.env.DB_NAME || process.env.SUPABASE_DB_NAME || 'postgres';

  if (!host || !password) {
    const missing = [
      !host ? 'PGHOST/DB_HOST/SUPABASE_DB_HOST' : null,
      !password ? 'PGPASSWORD/DB_PASSWORD/SUPABASE_DB_PASSWORD' : null,
    ].filter(Boolean);
    const err: any = new Error(`Postgres env missing: ${missing.join(', ')}`);
    err.status = 500;
    err.code = 'PG_ENV_MISSING';
    throw err;
  }

  pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
    // Production-ready pool configuration for Supabase
    max: 20,                            // Maximum pool size (increased from default 10)
    idleTimeoutMillis: 30000,           // 30s idle timeout (matches Supabase pooler)
    connectionTimeoutMillis: 10000,     // 10s connection timeout (prevent hanging)
    keepAlive: true,                    // Enable TCP keepalive
    keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
  });

  // Add error handler to prevent pool crashes
  pool.on('error', (err: Error) => {
    console.error('[pg] Unexpected pool error on idle client:', err);
    // Pool will automatically remove bad client, no action needed
  });

  pool.on('connect', () => {
    console.log('[pg] New client connected to pool');
  });

  console.log('[pg] ✓ PostgreSQL pool created with production configuration');
  return pool;
}

export function pgMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const p = getPool();
    (req as any).pg = p;
    next();
  } catch (err) {
    // Defer to central error handling
    next(err);
  }
}

/**
 * Gracefully close the PostgreSQL pool and all connections.
 * Should be called during application shutdown (SIGTERM/SIGINT).
 */
export async function closePgPool(): Promise<void> {
  if (pool) {
    console.log('[pg] Closing PostgreSQL pool...');
    try {
      await pool.end();
      pool = null;
      console.log('[pg] ✓ PostgreSQL pool closed successfully');
    } catch (err) {
      console.error('[pg] Error closing pool:', err);
      throw err;
    }
  }
}

/**
 * Get the current pool instance (for health checks or manual operations).
 * Returns null if pool hasn't been initialized yet.
 */
export function getPgPool(): Pool | null {
  return pool;
}

// Extend Express Request typing for convenience
declare global {
  namespace Express {
    interface Request {
      pg?: Pool;
    }
  }
}