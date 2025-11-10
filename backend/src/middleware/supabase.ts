import type { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Single client instance reused across requests
let supabase: SupabaseClient | null = null;

function getClient(url: string, key: string): SupabaseClient {
  if (supabase) return supabase;

  try {
    console.log('[supabase] Creating Supabase client...', {
      url,
      keyPrefix: key.substring(0, 20) + '...',
    });

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[supabase] ✓ Supabase client created successfully');
    return supabase;
  } catch (err) {
    console.error('[supabase] ✗ Failed to create Supabase client:', err);
    throw err;
  }
}

export function supabaseMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Decide up front if we have env; avoid throwing to keep PG-backed routes working
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.warn('[supabase] ✗ Supabase env missing; continuing without Supabase client');
      console.warn('[supabase] Environment check:', {
        SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'present' : 'missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'present' : 'missing',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'present' : 'missing',
      });
      (req as any).supabaseAvailable = false;
      (req as any).supabase = undefined;
      (req as any).db = undefined;
      (req as any).storage = undefined;
      return next();
    }

    const client = getClient(url, key);
    (req as any).supabaseAvailable = true;
    (req as any).supabase = client;
    (req as any).db = client; // alias for convenience
    (req as any).storage = client.storage;
    return next();
  } catch (err) {
    console.error('[supabase] ✗ Supabase middleware error (gracefully degrading):', err);
    console.error('[supabase] Error details:', {
      name: (err as any)?.name,
      message: (err as any)?.message,
      stack: (err as any)?.stack?.split('\n').slice(0, 3).join('\n'),
    });
    // Graceful degradation: proceed without Supabase so PG-backed endpoints still function
    (req as any).supabaseAvailable = false;
    (req as any).supabase = undefined;
    (req as any).db = undefined;
    (req as any).storage = undefined;
    return next();
  }
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      supabase?: SupabaseClient;
      db?: SupabaseClient;
      storage?: SupabaseClient['storage'];
      supabaseAvailable?: boolean;
    }
  }
}