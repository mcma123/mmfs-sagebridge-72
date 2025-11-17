-- Migration 023: Period-end and Year-end status tables
-- Soft-close tracking for month-end periods and year-end checklist tasks

-- ============================================================================
-- 1. Periods table (month-end status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting.periods (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Progress'
    CHECK (status IN ('Closed', 'In Progress', 'Future')),
  closed_date TIMESTAMPTZ NULL,
  closed_by BIGINT NULL REFERENCES app.users(id),
  reconciliations_done BOOLEAN NOT NULL DEFAULT FALSE,
  journals_done BOOLEAN NOT NULL DEFAULT FALSE,
  accounts_done BOOLEAN NOT NULL DEFAULT FALSE,
  taxes_done BOOLEAN NOT NULL DEFAULT FALSE,
  reports_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounting_period UNIQUE (period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_periods_year_start
  ON accounting.periods (DATE_TRUNC('year', period_start));

-- touch_updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_periods_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_periods_touch_updated_at
    BEFORE UPDATE ON accounting.periods
    FOR EACH ROW EXECUTE PROCEDURE accounting.touch_updated_at();
  END IF;
END $$;

COMMENT ON TABLE accounting.periods IS 'Accounting periods (month-end) with soft-close status and checklist flags';

-- ============================================================================
-- 2. Year-end checklist tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting.year_end_tasks (
  id BIGSERIAL PRIMARY KEY,
  fiscal_year INTEGER NOT NULL,
  task TEXT NOT NULL,
  critical BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NULL,
  completed_by BIGINT NULL REFERENCES app.users(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_year_end_task UNIQUE (fiscal_year, order_index)
);

CREATE INDEX IF NOT EXISTS idx_year_end_tasks_year
  ON accounting.year_end_tasks (fiscal_year);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_year_end_tasks_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_year_end_tasks_touch_updated_at
    BEFORE UPDATE ON accounting.year_end_tasks
    FOR EACH ROW EXECUTE PROCEDURE accounting.touch_updated_at();
  END IF;
END $$;

COMMENT ON TABLE accounting.year_end_tasks IS 'Year-end checklist tasks with critical flag and completion tracking';

-- ============================================================================
-- 3. Public views for Supabase Data API
-- ============================================================================

DROP VIEW IF EXISTS public.accounting_periods CASCADE;
CREATE VIEW public.accounting_periods AS
SELECT
  id,
  period_start,
  period_end,
  label,
  status,
  closed_date,
  closed_by,
  reconciliations_done,
  journals_done,
  accounts_done,
  taxes_done,
  reports_done,
  created_at,
  updated_at
FROM accounting.periods;

DROP VIEW IF EXISTS public.accounting_year_end_tasks CASCADE;
CREATE VIEW public.accounting_year_end_tasks AS
SELECT
  id,
  fiscal_year,
  task,
  critical,
  completed,
  completed_at,
  completed_by,
  order_index,
  created_at,
  updated_at
FROM accounting.year_end_tasks;

GRANT SELECT ON public.accounting_periods TO anon, authenticated, service_role;
GRANT SELECT ON public.accounting_year_end_tasks TO anon, authenticated, service_role;

COMMENT ON VIEW public.accounting_periods IS 'Public view for accounting.periods (month-end status)';
COMMENT ON VIEW public.accounting_year_end_tasks IS 'Public view for accounting.year_end_tasks (year-end checklist)';

-- ============================================================================
-- 4. Seed example data to match initial UI expectations
-- ============================================================================

-- Seed 2023 periods used by the PeriodEnd page mock data
INSERT INTO accounting.periods (
  period_start,
  period_end,
  label,
  status,
  closed_date,
  closed_by,
  reconciliations_done,
  journals_done,
  accounts_done,
  taxes_done,
  reports_done
) VALUES
  ('2023-01-01', '2023-01-31', 'January 2023', 'Closed', '2023-02-05', NULL, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('2023-02-01', '2023-02-28', 'February 2023', 'Closed', '2023-03-08', NULL, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('2023-03-01', '2023-03-31', 'March 2023', 'Closed', '2023-04-10', NULL, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('2023-04-01', '2023-04-30', 'April 2023', 'In Progress', NULL, NULL, TRUE, TRUE, FALSE, TRUE, FALSE),
  ('2023-05-01', '2023-05-31', 'May 2023', 'Future', NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('2023-06-01', '2023-06-30', 'June 2023', 'Future', NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (period_start, period_end) DO NOTHING;

-- Seed 2023 year-end checklist tasks to mirror UI
INSERT INTO accounting.year_end_tasks (
  fiscal_year,
  task,
  critical,
  completed,
  order_index
) VALUES
  (2023, 'Review outstanding invoices and bills', TRUE, TRUE, 1),
  (2023, 'Reconcile all bank accounts', TRUE, TRUE, 2),
  (2023, 'Post all outstanding journal entries', TRUE, TRUE, 3),
  (2023, 'Reconcile accounts receivable', TRUE, TRUE, 4),
  (2023, 'Reconcile accounts payable', TRUE, FALSE, 5),
  (2023, 'Review fixed asset register', FALSE, FALSE, 6),
  (2023, 'Calculate and post depreciation', TRUE, FALSE, 7),
  (2023, 'Review inventory valuation', TRUE, FALSE, 8),
  (2023, 'Post accruals and prepayments', TRUE, FALSE, 9),
  (2023, 'Generate preliminary financial statements', TRUE, FALSE, 10),
  (2023, 'Prepare tax worksheets', TRUE, FALSE, 11),
  (2023, 'Close revenue and expense accounts to retained earnings', TRUE, FALSE, 12)
ON CONFLICT (fiscal_year, order_index) DO NOTHING;

-- Migration 023 complete