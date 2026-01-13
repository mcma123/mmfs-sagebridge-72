
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

async function run() {
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
        // SSL removed for local/dokploy if needed
    });

    const email = 'mcmarsh.fif@gmail.com';
    const rawPassword = 'P@ssword61157';
    const displayName = 'MC Marsh';

    try {
        const client = await pool.connect();
        console.log('Connected to DB');

        // 1. Check if user exists
        const ures = await client.query('SELECT * FROM app.users WHERE email = $1', [email]);
        let userId;

        if (ures.rows.length === 0) {
            console.log('User not found. Creating...');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(rawPassword, salt);

            const insRes = await client.query(
                `INSERT INTO app.users (email, password_hash, display_name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id`,
                [email, hash, displayName]
            );
            userId = insRes.rows[0].id;
            console.log('User created with ID:', userId);
        } else {
            console.log('User found. Updating password...');
            userId = ures.rows[0].id;
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(rawPassword, salt);

            await client.query(
                'UPDATE app.users SET password_hash = $1, is_active = true WHERE id = $2',
                [hash, userId]
            );
            console.log('User password updated.');
        }

        // 2. Ensure Role exists (Admin)
        const rres = await client.query("SELECT id FROM app.roles WHERE name = 'Admin'");
        let roleId;
        if (rres.rows.length === 0) {
            console.log('Admin role not found. Creating...');
            const rins = await client.query("INSERT INTO app.roles (name) VALUES ('Admin') RETURNING id");
            roleId = rins.rows[0].id;
        } else {
            roleId = rres.rows[0].id;
        }

        // 3. Assign Role
        const urres = await client.query('SELECT * FROM app.user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
        if (urres.rows.length === 0) {
            console.log('Assigning Admin role...');
            await client.query('INSERT INTO app.user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
        } else {
            console.log('User already has Admin role.');
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
