import { Request, Response, NextFunction } from 'express';

type Role = 'Admin' | 'Editor' | 'Viewer';

function roleRank(role: Role): number {
  switch (role) {
    case 'Admin': return 3;
    case 'Editor': return 2;
    case 'Viewer': return 1;
    default: return 0;
  }
}

export function authorize(required: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleHeader = (req.headers['x-role'] || 'Viewer') as Role;
    const userRole: Role = roleHeader === 'Admin' || roleHeader === 'Editor' || roleHeader === 'Viewer' ? roleHeader : 'Viewer';
    if (roleRank(userRole) >= roleRank(required)) return next();
    return res.status(403).json({ error: 'Forbidden', required, provided: userRole });
  };
}