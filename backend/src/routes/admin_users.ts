import express from 'express';
import { authorize } from '../middleware/rbac';
import bcrypt from 'bcryptjs';

const router = express.Router();

// List users with roles
router.get('/', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const usersRes = await client.query(
      'SELECT id,email,display_name,is_active,last_login_at,created_at FROM app.users ORDER BY email ASC'
    );
    const users = usersRes.rows;
    const userIds = (users || []).map((u: any) => Number(u.id));
    let links: any[] = [];
    if (userIds.length) {
      const lres = await client.query('SELECT user_id, role_id FROM app.user_roles WHERE user_id = ANY($1)', [userIds]);
      links = lres.rows;
    }
    const rolesRes = await client.query('SELECT id, name FROM app.roles');
    const roleMap: Map<number, string> = new Map<number, string>((rolesRes.rows || []).map((r: any) => [Number(r.id), String(r.name)]));
    const rolesByUser: Record<number, string[]> = {};
    (links || []).forEach((l: any) => {
      const uid = Number(l.user_id);
      const rname = roleMap.get(Number(l.role_id));
      if (typeof rname === 'string') {
        rolesByUser[uid] = rolesByUser[uid] || [];
        rolesByUser[uid].push(rname);
      } else {
        rolesByUser[uid] = rolesByUser[uid] || [];
      }
    });
    const items = (users || []).map((u: any) => ({ ...u, roles: rolesByUser[Number(u.id)] || [] }));
    res.json({ items });
  } catch (err) { next(err); }
});

// Create user
router.post('/', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const { name, email, password, roles } = req.body || {};

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: { message: 'name, email, and password are required' }
      });
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { message: 'Name must be at least 2 characters' }
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: { message: 'Invalid email address' }
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: { message: 'Password must be at least 8 characters' }
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const hashed = await bcrypt.hash(password, 10);

    // Use transaction for atomicity
    await client.query('BEGIN');

    try {
      // Check for duplicate email
      const emailCheck = await client.query(
        'SELECT id FROM app.users WHERE email = $1',
        [normalizedEmail]
      );

      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' }
        });
      }

      // Create user
      const createdRes = await client.query(
        'INSERT INTO app.users(display_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,email,display_name,is_active,last_login_at,created_at',
        [name.trim(), normalizedEmail, hashed]
      );
      const created = createdRes.rows[0];

      // Assign roles
      const roleNames: string[] = Array.isArray(roles) ? roles : [];
      if (roleNames.length) {
        const rolesRes = await client.query('SELECT id,name FROM app.roles WHERE name = ANY($1::text[])', [roleNames]);
        const roleIds = (rolesRes.rows || []).map((r: any) => Number(r.id));
        if (roleIds.length) {
          const valuesClause = roleIds.map((_unused: number, i: number) => `($1,$${i + 2})`).join(',');
          await client.query(`INSERT INTO app.user_roles(user_id, role_id) VALUES ${valuesClause}`, [created.id, ...roleIds]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ id: created.id });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    // Handle PostgreSQL unique constraint violation
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(409).json({
        error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' }
      });
    }
    next(err);
  }
});

// Update user (display_name, is_active, password, roles, email)
router.patch('/:id', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const { id } = req.params;
    const { name, email, is_active, password, roles } = req.body || {};
    const userId = Number(id);

    // Check if user exists
    const userCheck = await client.query('SELECT id FROM app.users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: { message: 'User not found' }
      });
    }

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({
        error: { message: 'Name must be at least 2 characters' }
      });
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: { message: 'Invalid email address' }
        });
      }
    }

    if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 8)) {
      return res.status(400).json({
        error: { message: 'Password must be at least 8 characters' }
      });
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      sets.push(`display_name = $${idx++}`);
      params.push(name.trim());
    }

    if (email !== undefined) {
      // Check for duplicate email
      const normalizedEmail = String(email).toLowerCase().trim();
      const emailCheck = await client.query(
        'SELECT id FROM app.users WHERE email = $1 AND id != $2',
        [normalizedEmail, userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' }
        });
      }
      sets.push(`email = $${idx++}`);
      params.push(normalizedEmail);
    }

    if (is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      params.push(!!is_active);
    }

    if (password && password.length > 0) {
      const hashed = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${idx++}`);
      params.push(hashed);
    }

    if (sets.length) {
      params.push(userId);
      await client.query(`UPDATE app.users SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    }

    if (Array.isArray(roles)) {
      await client.query('DELETE FROM app.user_roles WHERE user_id = $1', [userId]);
      const rolesRes = await client.query('SELECT id,name FROM app.roles WHERE name = ANY($1::text[])', [roles]);
      const roleIds = (rolesRes.rows || []).map((r: any) => Number(r.id));
      if (roleIds.length) {
        const valuesClause = roleIds.map((_unused: number, i: number) => `($1,$${i + 2})`).join(',');
        await client.query(`INSERT INTO app.user_roles(user_id, role_id) VALUES ${valuesClause}`, [userId, ...roleIds]);
      }
    }

    res.json({ id: userId, success: true });
  } catch (err: any) {
    // Handle PostgreSQL unique constraint violation
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(409).json({
        error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' }
      });
    }
    next(err);
  }
});

// Delete user (hard delete)
router.delete('/:id', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const { id } = req.params;
    const userId = Number(id);

    // Prevent self-deletion
    if (req.user && req.user.id === userId) {
      return res.status(403).json({
        error: { message: 'Cannot delete your own account' }
      });
    }

    // Check if user exists
    const userCheck = await client.query('SELECT id FROM app.users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: { message: 'User not found' }
      });
    }

    // Delete user (CASCADE will handle user_roles)
    await client.query('DELETE FROM app.users WHERE id = $1', [userId]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Reset user password (admin only)
router.post('/:id/reset-password', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const { id } = req.params;
    const { newPassword } = req.body || {};
    const userId = Number(id);

    // Validate input
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        error: { message: 'newPassword is required' }
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: { message: 'Password must be at least 8 characters' }
      });
    }

    // Prevent resetting own password (use change password instead)
    if (req.user && req.user.id === userId) {
      return res.status(403).json({
        error: { message: 'Cannot reset your own password. Use change password instead.' }
      });
    }

    // Check if user exists
    const userCheck = await client.query('SELECT id FROM app.users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: { message: 'User not found' }
      });
    }

    // Hash and update password
    const hashed = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE app.users SET password_hash = $1 WHERE id = $2', [hashed, userId]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
