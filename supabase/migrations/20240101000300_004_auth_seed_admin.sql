-- Seed core roles and Admin user

-- Roles
INSERT INTO auth.roles (name, description)
VALUES
  ('admin', 'Full system access'),
  ('accountant', 'Accounting and banking access'),
  ('editor', 'DMS edit/upload access'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Admin user (email + hashed password)
INSERT INTO auth.users (email, password_hash, name, status)
VALUES (
  'admin@mmfs.co.za',
  crypt('P@sswordMMFSadmin', gen_salt('bf')),
  'System Administrator',
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
JOIN auth.roles r ON r.name = 'admin'
WHERE u.email = 'admin@mmfs.co.za'
ON CONFLICT DO NOTHING;