import { io, Socket } from 'socket.io-client';
import { getAccessToken, getPrimaryRole } from '@/lib/api/auth';
import type { EntityDTO, AccountDTO } from '@/lib/api/accounting';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (socket) return socket;
  // Connect to same-origin and proxy to backend via '/api' path
  socket = io(undefined, {
    path: '/api/socket.io',
    auth: () => ({ token: getAccessToken() || '' }),
    transports: ['websocket'],
    autoConnect: false,
  });
  return socket;
}

export async function ensureConnected(): Promise<void> {
  const s = getSocket();
  if (s.connected) return;
  await new Promise<void>((resolve, reject) => {
    const onConnect = () => { s.off('connect_error', onError); resolve(); };
    const onError = (err: any) => { s.off('connect', onConnect); reject(err); };
    s.once('connect', onConnect);
    s.once('connect_error', onError);
    s.connect();
  });
}

export async function fetchAccountingRefsRealtime(): Promise<{ entities: EntityDTO[]; accounts: AccountDTO[] }> {
  await ensureConnected();
  const s = getSocket();
  return new Promise((resolve, reject) => {
    s.timeout(5000).emit('accounting:fetchRefs', (err: any, resp: any) => {
      if (err) return reject(err);
      if (resp?.error) return reject(new Error(resp.error.message || 'Failed to fetch refs'));
      resolve({ entities: (resp?.entities || []) as EntityDTO[], accounts: (resp?.accounts || []) as AccountDTO[] });
    });
  });
}

// Fallback: call HTTP endpoints if WS fails
export async function fetchRefsRealtimeWithFallback(loadHttp: () => Promise<{ entities: EntityDTO[]; accounts: AccountDTO[] }>): Promise<{ entities: EntityDTO[]; accounts: AccountDTO[] }> {
  try {
    return await fetchAccountingRefsRealtime();
  } catch (_err) {
    // Attempt HTTP fallback
    return await loadHttp();
  }
}