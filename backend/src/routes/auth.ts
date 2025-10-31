import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

function highestRole(roles: string[]): string {
  const order: Record<string, number> = { admin: 4, accountant: 3, editor: 2, viewer: 1 };
  return roles.sort((a, b) => (order[b] || 0) - (order[a] || 0))[0] || 'viewer';
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

export default router;
