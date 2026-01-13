-- Create app schema and core tables used by backend auth
CREATE SCHEMA IF NOT EXISTS app;

-- Users table (maps to backend expectations)
CREATE TABLE IF NOT EXISTS app.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Roles table
CREATE TABLE IF NOT EXISTS app.roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- User roles mapping
CREATE TABLE IF NOT EXISTS app.user_roles (
  user_id BIGINT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES app.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app.users(email);
CREATE INDEX IF NOT EXISTS idx_app_user_roles_user ON app.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_roles_role ON app.user_roles(role_id);