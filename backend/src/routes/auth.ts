import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

function highestRole(roles: string[]): string {
  const order: Record<string, number> = { admin: 4, accountant: 3, editor: 2, viewer: 1 };
  return roles.sort((a, b) => (order[b] || 0) - (order[a] || 0))[0] || 'viewer';
}

// Middleware to verify JWT and attach user to request
function verifyToken(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

    try {
      const decoded = jwt.verify(token, secret) as any;
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }
  } catch (err) {
    next(err);
  }
}

router.post('/login', async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'email and password required' } });
    const client = req.pg!;
    const ures = await client.query(
      'SELECT id,email,display_name,is_active,password_hash FROM app.users WHERE email = $1 LIMIT 1',
      [String(email).toLowerCase().trim()]
    );
    const user = ures.rows[0];
    if (!user) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    if (!user.is_active) return res.status(403).json({ error: { code: 'USER_INACTIVE', message: 'User is inactive' } });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    const lres = await client.query('SELECT role_id FROM app.user_roles WHERE user_id = $1', [user.id]);
    const roleIds: number[] = (lres.rows || []).map((r: any) => Number(r.role_id));
    const rres = await client.query('SELECT name FROM app.roles WHERE id = ANY($1)', [roleIds.length ? roleIds : [-1]]);
    const roles: string[] = (rres.rows || []).map((r: any) => r.name);
    const primaryRole = highestRole(roles);

    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
    const token = jwt.sign(
      { sub: user.id, email: user.email, roles, name: user.display_name, role: primaryRole },
      secret,
      { expiresIn: '2h' }
    );

    await client.query('UPDATE app.users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    return res.json({
      accessToken: token,
      user: { id: user.id, email: user.email, displayName: user.display_name, roles },
      role: primaryRole,
    });
  } catch (err) {
    next(err);
  }
});

// GET /me - Fetch current authenticated user
router.get('/me', verifyToken, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.sub;
    const client = req.pg!;

    const ures = await client.query(
      'SELECT id, email, display_name, is_active, last_login_at, created_at FROM app.users WHERE id = $1 LIMIT 1',
      [userId]
    );

    const user = ures.rows[0];
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    // Fetch user roles
    const lres = await client.query('SELECT role_id FROM app.user_roles WHERE user_id = $1', [user.id]);
    const roleIds: number[] = (lres.rows || []).map((r: any) => Number(r.role_id));
    const rres = await client.query('SELECT name FROM app.roles WHERE id = ANY($1)', [roleIds.length ? roleIds : [-1]]);
    const roles: string[] = (rres.rows || []).map((r: any) => r.name);
    const primaryRole = highestRole(roles);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles,
        role: primaryRole,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /profile - Update user profile
router.put('/profile', verifyToken, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.sub;
    const { displayName } = req.body || {};

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'displayName is required' } });
    }

    const client = req.pg!;

    // Update user display name
    await client.query(
      'UPDATE app.users SET display_name = $1, updated_at = NOW() WHERE id = $2',
      [displayName.trim(), userId]
    );

    // Fetch updated user
    const ures = await client.query(
      'SELECT id, email, display_name, is_active FROM app.users WHERE id = $1 LIMIT 1',
      [userId]
    );

    const user = ures.rows[0];
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    // Fetch user roles
    const lres = await client.query('SELECT role_id FROM app.user_roles WHERE user_id = $1', [user.id]);
    const roleIds: number[] = (lres.rows || []).map((r: any) => Number(r.role_id));
    const rres = await client.query('SELECT name FROM app.roles WHERE id = ANY($1)', [roleIds.length ? roleIds : [-1]]);
    const roles: string[] = (rres.rows || []).map((r: any) => r.name);
    const primaryRole = highestRole(roles);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles,
        role: primaryRole,
        isActive: user.is_active,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
