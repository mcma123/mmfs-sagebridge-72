-- Seed core roles and Admin user into app.* (Supabase-safe)

-- Ensure expected columns exist in app.roles (idempotent)
ALTER TABLE IF EXISTS app.roles ADD COLUMN IF NOT EXISTS description TEXT;

-- Roles
INSERT INTO app.roles (name, description)
VALUES
  ('admin', 'Full system access'),
  ('accountant', 'Accounting and banking access'),
  ('editor', 'DMS edit/upload access'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Admin user with bcryptjs-hashed password
INSERT INTO app.users (email, display_name, password_hash, is_active)
VALUES (
  'admin@mmfs.co.za',
  'System Administrator',
  '$2a$10$M/UJglpoRO7PO.xkV5d6muFACZcATurviAWBo5tKZHL/bGGzIMQrS',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role to admin user
INSERT INTO app.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM app.users u
JOIN app.roles r ON r.name = 'admin'
WHERE u.email = 'admin@mmfs.co.za'
ON CONFLICT DO NOTHING;