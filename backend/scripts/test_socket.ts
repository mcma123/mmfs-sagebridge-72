import { io } from 'socket.io-client';

async function main() {
  const socket = io('http://localhost:3000', {
    path: '/api/socket.io',
    transports: ['websocket'],
    extraHeaders: { 'X-Role': 'accountant' },
    timeout: 5000,
  });

  await new Promise<void>((resolve) => {
    socket.on('connect', () => {
      console.log('[ws] connected, id=', socket.id);
      socket.emit('accounting:fetchRefs', (payload: any) => {
        console.log('[ws] refs ack:', {
          entities: Array.isArray(payload?.entities) ? payload.entities.length : null,
          accounts: Array.isArray(payload?.accounts) ? payload.accounts.length : null,
          error: payload?.error || null,
        });
        socket.close();
      });
    });
    socket.on('connect_error', (err: any) => {
      console.error('[ws] connect_error:', err?.message || err);
      socket.close();
      resolve();
    });
    socket.on('error', (err: any) => {
      console.error('[ws] error:', err?.message || err);
    });
    socket.on('disconnect', (reason) => {
      console.log('[ws] disconnected:', reason);
      resolve();
    });
  });
}

main().catch((err) => {
  console.error('[ws] script error:', err?.message || err);
  process.exit(1);
});