import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type Role = 'admin' | 'accountant' | 'editor' | 'viewer' | 'Admin' | 'Editor' | 'Viewer';

function normalizeRole(input: Role | string | undefined): 'admin' | 'accountant' | 'editor' | 'viewer' {
  const v = String(input || '').toLowerCase();
  switch (v) {
    case 'admin': return 'admin';
    case 'editor': return 'editor';
    case 'accountant': return 'accountant';
    case 'viewer': return 'viewer';
    default: return 'viewer';
  }
}

function roleRank(role: 'admin' | 'accountant' | 'editor' | 'viewer'): number {
  switch (role) {
    case 'admin': return 3;
    case 'editor':
    case 'accountant': return 2;
    case 'viewer':
    default: return 1;
  }
}

export function authorize(required: Role | Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    let roles: Array<'admin'|'accountant'|'editor'|'viewer'> = [];
    let effectiveRole: 'admin'|'accountant'|'editor'|'viewer' = 'viewer';

    const auth = req.headers['authorization'];
    if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7);
      try {
        const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
        const payload: any = jwt.verify(token, secret);
        const claimRoles = Array.isArray(payload?.roles) ? payload.roles.map((r: string) => normalizeRole(r)) : [];
        roles = claimRoles.length ? claimRoles : roles;
        effectiveRole = normalizeRole(payload?.role || claimRoles[0]);
        // attach user context
        (req as any).user = {
          id: payload?.sub,
          email: payload?.email,
          roles,
          role: effectiveRole,
          name: payload?.name,
        };
      } catch (_err) {
        // ignore JWT errors; fall back to X-Role bridging
      }
    }

    // Bridge: allow X-Role during transition if token missing or invalid
    if (!roles.length) {
      effectiveRole = normalizeRole(req.headers['x-role'] as string | undefined);
      roles = [effectiveRole];
    }

    const requiredList = Array.isArray(required) ? required.map(normalizeRole) : [normalizeRole(required)];

    // Authorization logic:
    // - If a single role is required, allow users with that role or higher rank.
    // - If multiple roles are provided, allow if ANY of the user's roles match.
    const isArrayRequirement = Array.isArray(required);
    const allowed = isArrayRequirement
      ? requiredList.some(r => roles.includes(r))
      : roleRank(effectiveRole) >= roleRank(requiredList[0]);

    if (allowed) return next();

    // Log authorization failure for debugging
    console.error('Authorization failed:', {
      path: req.path,
      method: req.method,
      required: requiredList,
      provided: effectiveRole,
      userRoles: roles,
      hasToken: !!auth,
      hasXRole: !!req.headers['x-role']
    });

    return res.status(403).json({ error: 'Forbidden', required: requiredList, provided: effectiveRole });
  };
}