/**
 * Check and Seed User Data
 * Verifies users exist and creates admin if missing
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function checkAndSeedUsers() {
    console.log('='.repeat(60));
    console.log('USER DATA CHECK & SEED');
    console.log('='.repeat(60));

    try {
        // Check app.users
        console.log('\n1. Checking app.users table...');
        const appUsers = await pool.query('SELECT id, email, display_name, is_active FROM app.users');
        console.log(`   Found ${appUsers.rows.length} users in app.users`);
        appUsers.rows.forEach(u => console.log(`   - ${u.email} (active: ${u.is_active})`));

        // Check app.roles
        console.log('\n2. Checking app.roles table...');
        const appRoles = await pool.query('SELECT id, name, description FROM app.roles');
        console.log(`   Found ${appRoles.rows.length} roles in app.roles`);
        appRoles.rows.forEach(r => console.log(`   - ${r.name}: ${r.description}`));

        // Check auth.users (Supabase managed)
        console.log('\n3. Checking auth.users table (Supabase Auth)...');
        const authUsers = await pool.query('SELECT id, email, created_at FROM auth.users LIMIT 10');
        console.log(`   Found ${authUsers.rows.length} users in auth.users`);
        authUsers.rows.forEach(u => console.log(`   - ${u.email}`));

        // If no users exist in app.users, seed them
        if (appUsers.rows.length === 0) {
            console.log('\n4. Seeding admin user...');

            // Create password hash
            const password = 'P@sswordMMFSadmin';
            const hash = await bcrypt.hash(password, 10);

            // Insert admin user
            await pool.query(`
        INSERT INTO app.users (email, display_name, password_hash, is_active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (email) DO UPDATE SET password_hash = $3
      `, ['admin@mmfs.co.za', 'System Administrator', hash]);

            console.log('   ✓ Created admin user: admin@mmfs.co.za');
            console.log(`   ✓ Password: ${password}`);

            // Ensure roles exist
            await pool.query(`
        INSERT INTO app.roles (name, description)
        VALUES 
          ('admin', 'Full system access'),
          ('accountant', 'Accounting and banking access'),
          ('editor', 'DMS edit/upload access'),
          ('viewer', 'Read-only access')
        ON CONFLICT (name) DO NOTHING
      `);
            console.log('   ✓ Roles created');

            // Assign admin role
            await pool.query(`
        INSERT INTO app.user_roles (user_id, role_id)
        SELECT u.id, r.id
        FROM app.users u
        JOIN app.roles r ON r.name = 'admin'
        WHERE u.email = 'admin@mmfs.co.za'
        ON CONFLICT DO NOTHING
      `);
            console.log('   ✓ Admin role assigned');
        } else {
            console.log('\n4. Users already exist, updating password hash...');
            const password = 'P@sswordMMFSadmin';
            const hash = await bcrypt.hash(password, 10);
            await pool.query(`
        UPDATE app.users SET password_hash = $1 WHERE email = 'admin@mmfs.co.za'
      `, [hash]);
            console.log('   ✓ Password hash updated for admin@mmfs.co.za');
            console.log(`   ✓ Password: ${password}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('LOGIN CREDENTIALS:');
        console.log('  Email: admin@mmfs.co.za');
        console.log('  Password: P@sswordMMFSadmin');
        console.log('='.repeat(60));

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkAndSeedUsers();
