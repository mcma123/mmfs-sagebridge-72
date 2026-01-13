-- Create auth schema and core tables
CREATE SCHEMA IF NOT EXISTS auth;

-- pgcrypto for bcrypt password hashing via crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS auth.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Roles table
CREATE TABLE IF NOT EXISTS auth.roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- User roles mapping
CREATE TABLE IF NOT EXISTS auth.user_roles (
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth.users(status);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user ON auth.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role ON auth.user_roles(role_id);