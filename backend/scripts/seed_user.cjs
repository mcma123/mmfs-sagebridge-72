// Seed user script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.mmfs-supabase:4z4jpz26bh4pfn4uos1szetcts6mx1gs@mmfs-supabase-76e1a5-147-79-100-232.traefik.me:6543/postgres'
});

const email = 'mcmarsh.fif@gmail.com';
const password = 'P@ssword61157';
const displayName = 'Mcmarsh User';

async function seedUser() {
    const hash = bcrypt.hashSync(password, 10);

    // Insert or update user
    await pool.query(
        `INSERT INTO app.users (email, display_name, password_hash, is_active) 
     VALUES ($1, $2, $3, TRUE) 
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, display_name = $2`,
        [email, displayName, hash]
    );

    // Get user ID
    const userRes = await pool.query(`SELECT id FROM app.users WHERE email = $1`, [email]);
    const userId = userRes.rows[0].id;

    // Get admin role ID
    const roleRes = await pool.query(`SELECT id FROM app.roles WHERE name = 'admin'`);
    const roleId = roleRes.rows[0].id;

    // Assign admin role
    await pool.query(
        `INSERT INTO app.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, roleId]
    );

    console.log(`✓ User ${email} created with admin role (ID: ${userId})`);
    await pool.end();
}

seedUser().catch(e => {
    console.error('✗ Error:', e.message);
    process.exit(1);
});
