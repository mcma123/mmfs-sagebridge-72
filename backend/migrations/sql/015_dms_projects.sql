-- DMS Projects schema and tables
CREATE SCHEMA IF NOT EXISTS dms;

-- Create enum type for project status if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'project_status'
      AND n.nspname = 'dms'
  ) THEN
    CREATE TYPE dms.project_status AS ENUM ('Draft','Active','Pending Approval','In Progress','Done','Cancelled');
  END IF;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS dms.projects (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  client TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Facultative','Treaty')),
  coverage TEXT NOT NULL,
  value_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('USD','EUR','GBP','ZAR')),
  due_date DATE,
  status dms.project_status NOT NULL DEFAULT 'Active',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  latest_note TEXT,
  last_update TIMESTAMPTZ,
  stage TEXT,
  team JSONB DEFAULT '[]'::jsonb,
  days_in_stage INTEGER DEFAULT 0,
  blockers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dms_projects_status ON dms.projects(status);
CREATE INDEX IF NOT EXISTS idx_dms_projects_progress ON dms.projects(progress);
CREATE INDEX IF NOT EXISTS idx_dms_projects_created_at ON dms.projects(created_at);
CREATE INDEX IF NOT EXISTS idx_dms_projects_updated_at ON dms.projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_dms_projects_due_date ON dms.projects(due_date);
CREATE INDEX IF NOT EXISTS idx_dms_projects_team_gin ON dms.projects USING GIN (team);
CREATE INDEX IF NOT EXISTS idx_dms_projects_blockers_gin ON dms.projects USING GIN (blockers);

-- Project notes table
CREATE TABLE IF NOT EXISTS dms.project_notes (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES dms.projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dms_project_notes_project ON dms.project_notes(project_id);

-- updated_at trigger function and trigger (idempotent)
CREATE OR REPLACE FUNCTION dms.set_timestamp_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$;

-- Recreate trigger safely (idempotent)
DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON dms.projects;
CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON dms.projects
FOR EACH ROW
EXECUTE PROCEDURE dms.set_timestamp_updated_at();