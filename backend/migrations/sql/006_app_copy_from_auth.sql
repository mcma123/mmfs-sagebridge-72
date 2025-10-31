-- Copy users, roles, and mappings from legacy auth.* into app.*

-- Ensure app.* exists (idempotent safeguard)
CREATE SCHEMA IF NOT EXISTS app;

-- Ensure expected columns exist even if tables predate 005_app_init
ALTER TABLE IF EXISTS app.roles ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed roles from auth.roles into app.roles
INSERT INTO app.roles(name, description)
SELECT r.name, COALESCE(r.description,'')
FROM auth.roles r
ON CONFLICT (name) DO NOTHING;

-- Seed users from auth.users into app.users
INSERT INTO app.users(email, display_name, is_active, password_hash, created_at, updated_at)
SELECT u.email,
       u.name AS display_name,
       (u.status = 'active') AS is_active,
       u.password_hash,
       u.created_at,
       u.updated_at
FROM auth.users u
ON CONFLICT (email) DO NOTHING;

-- Map user_roles via role names (to resolve id differences)
INSERT INTO app.user_roles(user_id, role_id)
SELECT au.id AS user_id,
       ar.id AS role_id
FROM auth.user_roles aur
JOIN auth.users u ON u.id = aur.user_id
JOIN auth.roles r ON r.id = aur.role_id
JOIN app.users au ON au.email = u.email
JOIN app.roles ar ON ar.name = r.name
ON CONFLICT DO NOTHING;