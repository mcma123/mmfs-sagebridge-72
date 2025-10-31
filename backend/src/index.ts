import 'dotenv/config';
import app from './server';

const PORT = Number(process.env.API_PORT || 3001);

// Debug: print relevant Supabase envs at startup
console.log('[backend] Env check:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  HAS_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  HAS_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  HAS_VITE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
});

app.listen(PORT, () => {
  console.log(`[backend] API server listening on http://localhost:${PORT}`);
});