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
    if (!name || !email || !password) throw { status: 400, code: 'INVALID_BODY', message: 'name, email, password required' };
    const hashed = await bcrypt.hash(password, 10);
    const createdRes = await client.query(
      'INSERT INTO app.users(display_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,email,display_name,is_active,last_login_at,created_at',
      [name, String(email).toLowerCase().trim(), hashed]
    );
    const created = createdRes.rows[0];

    const roleNames: string[] = Array.isArray(roles) ? roles : [];
    if (roleNames.length) {
      const rolesRes = await client.query('SELECT id,name FROM app.roles WHERE name = ANY($1::text[])', [roleNames]);
      const roleIds = (rolesRes.rows || []).map((r: any) => Number(r.id));
      if (roleIds.length) {
        const valuesClause = roleIds.map((_unused: number, i: number) => `($1,$${i + 2})`).join(',');
        await client.query(`INSERT INTO app.user_roles(user_id, role_id) VALUES ${valuesClause}`, [created.id, ...roleIds]);
      }
    }

    res.status(201).json({ id: created.id });
  } catch (err) { next(err); }
});

// Update user (display_name, is_active, password, roles)
router.patch('/:id', authorize(['admin']), async (req: any, res: any, next: any) => {
  try {
    const client = req.pg!;
    const { id } = req.params;
    const { name, is_active, password, roles } = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`display_name = $${idx++}`); params.push(name); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(!!is_active); }
    if (password) { const hashed = await bcrypt.hash(password, 10); sets.push(`password_hash = $${idx++}`); params.push(hashed); }
    if (sets.length) {
      params.push(Number(id));
      await client.query(`UPDATE app.users SET ${sets.join(', ')} WHERE id = $${idx}` , params);
    }
    if (Array.isArray(roles)) {
      await client.query('DELETE FROM app.user_roles WHERE user_id = $1', [Number(id)]);
      const rolesRes = await client.query('SELECT id,name FROM app.roles WHERE name = ANY($1::text[])', [roles]);
      const roleIds = (rolesRes.rows || []).map((r: any) => Number(r.id));
      if (roleIds.length) {
        const valuesClause = roleIds.map((_unused: number, i: number) => `($1,$${i + 2})`).join(',');
        await client.query(`INSERT INTO app.user_roles(user_id, role_id) VALUES ${valuesClause}`, [Number(id), ...roleIds]);
      }
    }

    res.json({ id: Number(id), success: true });
  } catch (err) { next(err); }
});

export default router;
