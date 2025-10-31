import type { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a single client instance to reuse across requests
let supabase: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  // Read env at call time to ensure dotenv-loaded values are visible
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[backend] Supabase env missing', {
      urlCandidate: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnon: !!process.env.SUPABASE_ANON_KEY,
      hasViteAnon: !!process.env.VITE_SUPABASE_ANON_KEY,
    });
    throw Object.assign(new Error('Supabase env missing'), { status: 500, code: 'SUPABASE_ENV_MISSING' });
  }
  if (!supabase) {
    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

export function supabaseMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Attach client and simple helpers to the request
    const client = getClient();
    (req as any).supabase = client;
    (req as any).db = client; // alias
    (req as any).storage = client.storage;
    next();
  } catch (err) {
    next(err);
  }
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      supabase?: SupabaseClient;
      db?: SupabaseClient;
      storage?: SupabaseClient['storage'];
    }
  }
}