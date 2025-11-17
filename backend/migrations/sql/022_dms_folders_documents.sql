-- DMS Folders and Documents schema
-- This migration updates existing tables or creates new ones for storing folders and documents
-- replacing the localStorage-based implementation

-- Ensure DMS schema exists (should be created by 015_dms_projects.sql)
CREATE SCHEMA IF NOT EXISTS dms;

-- Folder type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'folder_type'
      AND n.nspname = 'dms'
  ) THEN
    CREATE TYPE dms.folder_type AS ENUM ('company','country','cedant','category','treaty_section','generic');
  END IF;
END $$;

-- Folders table with hierarchical path support
CREATE TABLE IF NOT EXISTS dms.folders (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT,
  parent_id BIGINT REFERENCES dms.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  type dms.folder_type NOT NULL DEFAULT 'generic',
  path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS dms.documents (
  id BIGSERIAL PRIMARY KEY,
  folder_id BIGINT NOT NULL REFERENCES dms.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ext TEXT,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to documents if they don't exist
DO $$
BEGIN
  -- Add tags column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'documents' AND column_name = 'tags'
  ) THEN
    ALTER TABLE dms.documents ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Add metadata_json column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'documents' AND column_name = 'metadata_json'
  ) THEN
    ALTER TABLE dms.documents ADD COLUMN metadata_json JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Fix uploaded_by column type if it's BIGINT (should be TEXT for email/username)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'documents'
    AND column_name = 'uploaded_by' AND data_type = 'bigint'
  ) THEN
    ALTER TABLE dms.documents ALTER COLUMN uploaded_by TYPE TEXT USING uploaded_by::TEXT;
  END IF;
END $$;

-- Document versions table (for version history)
CREATE TABLE IF NOT EXISTS dms.document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES dms.documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_versions_unique_version UNIQUE (document_id, version)
);

-- Audit log table for document/folder changes
CREATE TABLE IF NOT EXISTS dms.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  actor TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

-- Folders indexes
CREATE INDEX IF NOT EXISTS idx_dms_folders_parent_id ON dms.folders(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dms_folders_company_id ON dms.folders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dms_folders_path ON dms.folders USING btree (path) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dms_folders_type ON dms.folders(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dms_folders_metadata_gin ON dms.folders USING GIN (metadata_json);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_dms_documents_folder_id ON dms.documents(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dms_documents_storage_key ON dms.documents(storage_key);
CREATE INDEX IF NOT EXISTS idx_dms_documents_uploaded_by ON dms.documents(uploaded_by) WHERE deleted_at IS NULL;

-- Create tags index only if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'documents' AND column_name = 'tags'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_dms_documents_tags_gin ON dms.documents USING GIN (tags);
  END IF;
END $$;

-- Create metadata_json index only if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'documents' AND column_name = 'metadata_json'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_dms_documents_metadata_gin ON dms.documents USING GIN (metadata_json);
  END IF;
END $$;

-- Document versions indexes
CREATE INDEX IF NOT EXISTS idx_dms_document_versions_document_id ON dms.document_versions(document_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_dms_audit_logs_entity ON dms.audit_logs(entity_type, entity_id);

-- Create actor index only if the actor column exists (not actor_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'audit_logs' AND column_name = 'actor'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_dms_audit_logs_actor ON dms.audit_logs(actor);
  END IF;

  -- Create actor_id index if that's the column name instead
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dms' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_dms_audit_logs_actor_id ON dms.audit_logs(actor_id);
  END IF;
END $$;

-- ============================================================================
-- TRIGGERS for automatic timestamp updates
-- ============================================================================

-- Reuse the timestamp function from 015_dms_projects.sql if it exists
CREATE OR REPLACE FUNCTION dms.set_timestamp_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$;

-- Folders updated_at trigger
DROP TRIGGER IF EXISTS trg_folders_set_updated_at ON dms.folders;
CREATE TRIGGER trg_folders_set_updated_at
BEFORE UPDATE ON dms.folders
FOR EACH ROW
EXECUTE PROCEDURE dms.set_timestamp_updated_at();

-- Documents updated_at trigger
DROP TRIGGER IF EXISTS trg_documents_set_updated_at ON dms.documents;
CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON dms.documents
FOR EACH ROW
EXECUTE PROCEDURE dms.set_timestamp_updated_at();

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for active (non-deleted) folders with breadcrumbs
CREATE OR REPLACE VIEW dms.v_folders_active AS
SELECT
  f.id,
  f.company_id,
  f.parent_id,
  f.name,
  f.slug,
  f.type,
  f.path,
  f.depth,
  f.order_index,
  f.metadata_json,
  f.created_at,
  f.updated_at,
  (SELECT COUNT(*) FROM dms.folders cf WHERE cf.parent_id = f.id AND cf.deleted_at IS NULL) AS child_folder_count,
  (SELECT COUNT(*) FROM dms.documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS document_count
FROM dms.folders f
WHERE f.deleted_at IS NULL;

-- View for active documents with folder info
CREATE OR REPLACE VIEW dms.v_documents_active AS
SELECT
  d.id,
  d.folder_id,
  d.name,
  d.ext,
  d.mime_type,
  d.size_bytes,
  d.storage_key,
  d.checksum_sha256,
  d.version,
  d.uploaded_by,
  d.created_at,
  d.updated_at,
  f.name AS folder_name,
  f.path AS folder_path,
  f.type AS folder_type
FROM dms.documents d
JOIN dms.folders f ON f.id = d.folder_id
WHERE d.deleted_at IS NULL AND f.deleted_at IS NULL;

-- ============================================================================
-- SEED DATA (Optional: Create root folder for testing)
-- ============================================================================

-- Insert root folder for DMS if it doesn't exist (handle both company_id NULL and NOT NULL scenarios)
DO $$
BEGIN
  -- Try to insert with company_id if it's nullable
  BEGIN
    INSERT INTO dms.folders (id, company_id, name, type, path, depth, order_index)
    VALUES (1, NULL, 'Root', 'generic', '/1', 0, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN not_null_violation THEN
      -- If company_id is NOT NULL, skip the insert
      NULL;
  END;
END $$;

-- Reset sequence to avoid ID conflicts
SELECT setval('dms.folders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM dms.folders), true);

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================

COMMENT ON TABLE dms.folders IS 'Hierarchical folder structure for document organization';
COMMENT ON TABLE dms.documents IS 'Document metadata with references to Supabase storage';
COMMENT ON TABLE dms.document_versions IS 'Version history for documents';
COMMENT ON TABLE dms.audit_logs IS 'Audit trail for folder and document operations';

COMMENT ON COLUMN dms.folders.path IS 'Materialized path for efficient tree queries (e.g., /1/42/103)';
COMMENT ON COLUMN dms.folders.depth IS 'Tree depth, 0 for root folders';
COMMENT ON COLUMN dms.documents.storage_key IS 'S3/Supabase storage key for file retrieval';
COMMENT ON COLUMN dms.documents.checksum_sha256 IS 'SHA256 hash for file integrity verification';
