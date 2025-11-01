import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
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