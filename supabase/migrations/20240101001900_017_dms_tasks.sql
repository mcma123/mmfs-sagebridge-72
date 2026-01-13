-- DMS Tasks schema and tables
CREATE SCHEMA IF NOT EXISTS dms;

-- Create enum type for task status if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'task_status'
      AND n.nspname = 'dms'
  ) THEN
    CREATE TYPE dms.task_status AS ENUM ('Open','In Progress','Blocked','Done','Cancelled');
  END IF;
END $$;

-- Create enum type for task priority if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'task_priority'
      AND n.nspname = 'dms'
  ) THEN
    CREATE TYPE dms.task_priority AS ENUM ('Low','Medium','High','Urgent');
  END IF;
END $$;

-- Tasks table
CREATE TABLE IF NOT EXISTS dms.tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NULL REFERENCES dms.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  assignee TEXT NOT NULL,
  due_date DATE NOT NULL,
  priority dms.task_priority NOT NULL DEFAULT 'Medium',
  status dms.task_status NOT NULL DEFAULT 'Open',
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC(8,2),
  latest_note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dms_tasks_status ON dms.tasks(status);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_priority ON dms.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_assignee ON dms.tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_due_date ON dms.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_project_id ON dms.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_created_at ON dms.tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_updated_at ON dms.tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_dms_tasks_tags_gin ON dms.tasks USING GIN (tags);

-- Task notes table
CREATE TABLE IF NOT EXISTS dms.task_notes (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES dms.tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dms_task_notes_task ON dms.task_notes(task_id);

-- Ensure updated_at trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION dms.set_timestamp_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$;

-- Recreate trigger safely (idempotent)
DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON dms.tasks;
CREATE TRIGGER trg_tasks_set_updated_at
BEFORE UPDATE ON dms.tasks
FOR EACH ROW
EXECUTE PROCEDURE dms.set_timestamp_updated_at();