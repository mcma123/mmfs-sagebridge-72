import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

/**
 * Set the Socket.IO instance for dashboard broadcasts
 * Called during server initialization
 */
export function setDashboardIO(io: SocketIOServer) {
  ioInstance = io;
}

/**
 * Broadcast dashboard refresh event to all subscribed clients
 */
export function broadcastDashboardRefresh(data: {
  type: 'journal:posted' | 'journal:created' | 'account:updated' | 'entity:modified' | 'general';
  affectedAccounts?: number[];
  affectedEntities?: number[];
  journalId?: number;
  message?: string;
}) {
  if (!ioInstance) {
    console.warn('[dashboard-broadcast] Socket.IO instance not initialized');
    return;
  }

  const payload = {
    ...data,
    timestamp: new Date().toISOString(),
  };

  ioInstance.to('dashboard-updates').emit('dashboard:refresh', payload);
  console.log(`[dashboard-broadcast] Sent refresh event: ${data.type}`);
}

/**
 * Broadcast journal posted event specifically
 */
export function broadcastJournalPosted(journalId: number, affectedAccounts: number[] = []) {
  broadcastDashboardRefresh({
    type: 'journal:posted',
    journalId,
    affectedAccounts,
    message: `Journal #${journalId} posted`,
  });
}

/**
 * Broadcast account balance updated event
 */
export function broadcastAccountUpdated(accountIds: number[]) {
  broadcastDashboardRefresh({
    type: 'account:updated',
    affectedAccounts: accountIds,
    message: `${accountIds.length} account(s) updated`,
  });
}

/**
 * Broadcast entity modified event
 */
export function broadcastEntityModified(entityIds: number[]) {
  broadcastDashboardRefresh({
    type: 'entity:modified',
    affectedEntities: entityIds,
    message: `${entityIds.length} entity(ies) modified`,
  });
}

/**
 * Broadcast general dashboard refresh
 */
export function broadcastGeneralRefresh(message?: string) {
  broadcastDashboardRefresh({
    type: 'general',
    message,
  });
}
