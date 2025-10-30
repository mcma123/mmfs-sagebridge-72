-- Phase 2 – Initial schema (PostgreSQL dialect)

CREATE TYPE folder_type AS ENUM ('company','country','cedant','category','treaty_section','generic');

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  parent_id INTEGER REFERENCES folders(id),
  name TEXT NOT NULL,
  slug TEXT,
  type folder_type NOT NULL,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX folders_unique_name_per_parent ON folders(company_id, parent_id, name) WHERE deleted_at IS NULL;
CREATE INDEX folders_path_idx ON folders USING GIN (path gin_trgm_ops);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id),
  name TEXT NOT NULL,
  ext TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_key TEXT NOT NULL,
  checksum_sha256 TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX documents_folder_idx ON documents(folder_id);
CREATE INDEX documents_storage_key_idx ON documents(storage_key);
CREATE INDEX documents_checksum_idx ON documents(checksum_sha256);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL, -- 'user' | 'group' | 'role'
  subject_id INTEGER NOT NULL,
  folder_id INTEGER NOT NULL REFERENCES folders(id),
  role TEXT NOT NULL CHECK (role IN ('Admin','Editor','Viewer'))
);

CREATE INDEX permissions_subject_folder_idx ON permissions(subject_type, subject_id, folder_id);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id)
);

CREATE UNIQUE INDEX tags_unique_company_name ON tags(company_id, name);

CREATE TABLE document_tags (
  document_id INTEGER NOT NULL REFERENCES documents(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY(document_id, tag_id)
);

CREATE TABLE audit_logs (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  metadata_json JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Depth safeguard (example trigger placeholder)
-- Enforce max depth via application logic or trigger