import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Role = 'admin' | 'accountant' | 'editor' | 'viewer';

function normalizeRole(input?: string): Role {
  const v = String(input || '').toLowerCase();
  switch (v) {
    case 'admin': return 'admin';
    case 'accountant': return 'accountant';
    case 'editor': return 'editor';
    case 'viewer':
    default: return 'viewer';
  }
}

function roleRank(role: Role): number {
  switch (role) {
    case 'admin': return 3;
    case 'accountant':
    case 'editor': return 2;
    case 'viewer':
    default: return 1;
  }
}

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw Object.assign(new Error('Supabase env missing'), { status: 500, code: 'SUPABASE_ENV_MISSING' });
  }
  if (!supabase) {
    supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return supabase;
}

function getUserFromHandshake(socket: Socket): { id?: number|string; email?: string; roles: Role[]; role: Role } {
  let roles: Role[] = [];
  let effectiveRole: Role = 'viewer';

  const authToken = (socket.handshake.auth as any)?.token as string | undefined;
  const authHeader = socket.handshake.headers?.authorization as string | undefined;
  let bearer: string | undefined;
  if (authToken) bearer = authToken;
  else if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) bearer = authHeader.slice(7);

  if (bearer) {
    try {
      const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
      const payload: any = jwt.verify(bearer, secret);
      const claimRoles = Array.isArray(payload?.roles) ? payload.roles.map((r: string) => normalizeRole(r)) : [];
      roles = claimRoles.length ? claimRoles as Role[] : roles;
      effectiveRole = normalizeRole(payload?.role || claimRoles[0]);
      socket.data.user = {
        id: payload?.sub,
        email: payload?.email,
        roles,
        role: effectiveRole,
        name: payload?.name,
      };
    } catch {
      // ignore JWT errors; fall back to X-Role bridging
    }
  }

  if (!roles.length) {
    effectiveRole = normalizeRole(socket.handshake.headers['x-role'] as string | undefined);
    roles = [effectiveRole];
  }

  return { id: (socket.data.user as any)?.id, email: (socket.data.user as any)?.email, roles, role: effectiveRole };
}

function isAllowed(userRole: Role, required: Role | Role[]): boolean {
  const requiredList = Array.isArray(required) ? required.map(normalizeRole) as Role[] : [normalizeRole(required)];
  const isArrayRequirement = Array.isArray(required);
  return isArrayRequirement
    ? requiredList.includes(userRole)
    : roleRank(userRole) >= roleRank(requiredList[0]);
}

export function initAccountingRealtime(io: Server) {
  io.on('connection', (socket) => {
    const user = getUserFromHandshake(socket);
    const who = user.email || user.id || 'anonymous';
    console.log(`[ws] client connected: ${who} role=${user.role}`);

    socket.on('disconnect', (reason) => {
      console.log(`[ws] client disconnected: ${who} reason=${reason}`);
    });

    // Subscribe to dashboard updates
    socket.on('dashboard:subscribe', (ack?: (payload: any) => void) => {
      try {
        socket.join('dashboard-updates');
        console.log(`[ws] ${who} subscribed to dashboard updates`);
        if (ack) return ack({ success: true });
      } catch (err: any) {
        const payload = { error: { message: String(err?.message || err), code: 'SUBSCRIBE_ERROR' } };
        if (ack) return ack(payload);
      }
    });

    // Unsubscribe from dashboard updates
    socket.on('dashboard:unsubscribe', (ack?: (payload: any) => void) => {
      try {
        socket.leave('dashboard-updates');
        console.log(`[ws] ${who} unsubscribed from dashboard updates`);
        if (ack) return ack({ success: true });
      } catch (err: any) {
        const payload = { error: { message: String(err?.message || err), code: 'UNSUBSCRIBE_ERROR' } };
        if (ack) return ack(payload);
      }
    });

    // Fetch accounting refs (entities + accounts)
    socket.on('accounting:fetchRefs', async (ack?: (payload: any) => void) => {
      try {
        if (!isAllowed(user.role, ['admin','accountant','editor','viewer'])) {
          const payload = { error: { message: 'Forbidden', code: 'FORBIDDEN', status: 403 } };
          if (ack) return ack(payload);
          return socket.emit('accounting:error', payload);
        }

        const db = getSupabase();
        const entitiesQ = db
          .from('accounting_entities')
          .select('*')
          .order('name', { ascending: true });
        const accountsQ = db
          .from('accounting_accounts')
          .select('*')
          .order('code', { ascending: true });

        const [entities, accounts] = await Promise.all([entitiesQ, accountsQ]);
        if (entities.error) throw Object.assign(new Error(entities.error.message), { status: 500, code: 'DB_ERROR' });
        if (accounts.error) throw Object.assign(new Error(accounts.error.message), { status: 500, code: 'DB_ERROR' });

        const payload = {
          entities: (entities.data || []).filter((e: any) => !('deleted_at' in e) || e.deleted_at === null),
          accounts: accounts.data || [],
        };
        if (ack) return ack(payload);
        socket.emit('accounting:refs', payload);
      } catch (err: any) {
        const payload = { error: { message: String(err?.message || err), code: err?.code || 'UNKNOWN', status: err?.status || 500 } };
        if (ack) return ack(payload);
        socket.emit('accounting:error', payload);
      }
    });
  });
}