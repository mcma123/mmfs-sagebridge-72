// Load environment variables with explicit path to project root
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

// Load .env from project root
const result = config({ path: envPath });

if (result.error) {
  console.warn('[dotenv] Warning: Could not load .env file from:', envPath);
  console.warn('[dotenv] Error:', result.error.message);
} else {
  console.log('[dotenv] ✓ Loaded .env from:', envPath);
}

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './server';
import { initAccountingRealtime } from './realtime/accounting';

const PORT = Number(process.env.PORT || 3000);

// Debug: print relevant Supabase envs at startup
console.log('[backend] Env check:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  HAS_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  HAS_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  HAS_VITE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
});

// Health check: warn if Supabase env is missing
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('\n⚠️  WARNING: Supabase environment variables are not configured!');
  console.warn('   Endpoints using Supabase Data API will fail (accounts, journals, ledger).');
  console.warn('   Trial Balance will continue to work (uses direct PostgreSQL).');
  console.warn('\n   To fix:');
  console.warn('   1. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env');
  console.warn('   2. Run: npx tsx backend/scripts/fix_supabase_connection.ts');
  console.warn('   3. See: ENV_SETUP_GUIDE.md for detailed instructions\n');
}

// Serve static files from Vite build in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../../dist');

app.use(express.static(distPath));

// Catch-all route for client-side routing (must be last)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  path: '/api/socket.io',
  cors: {
    // Allow any dev origin; tighten in production if needed
    origin: '*',
    credentials: true,
  },
});

// Initialize realtime modules
initAccountingRealtime(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] API server listening on http://localhost:${PORT}`);
});