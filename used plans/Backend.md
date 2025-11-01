# Backend Architecture & Supabase Database Plan

This plan defines how to make the application a full‑stack system using an Express backend deployed on Vercel and a Supabase Postgres + Storage database. It covers both the Document Management System (DMS) and Accounting modules, aligning with existing code, OpenAPI specs, and ERD documents.

## Goals
- Consolidate the backend into a single Express application compatible with Vercel.
- Model DMS and Accounting data in Supabase, with clear schemas, indexes, and policies.
- Provide storage for documents via Supabase Storage, with signed URLs.
- Implement robust middleware (auth/RBAC, error handling, telemetry) and align endpoints with `docs/openapi.yaml`.
- Use Supabase MCP to create/apply migrations, manage branches, and generate types.

## Vercel Express Constraints
- Place the Express entrypoint at one of Vercel’s supported paths and export the app as default (`export default app`) or use `app.listen`.
- Static assets must live in `public/`; `express.static()` is ignored.
- The Express app is bundled into a single serverless function (250 MB limit) and auto‑scales. Implement robust error handling so failures don’t leave the function in an undefined state.
- Reference: Express on Vercel (https://vercel.com/docs/frameworks/backend/express).

## High‑Level Architecture
- Backend: `server.ts` at repo root imports module routers from `backend/src/` and exports the Express `app`.
- Routers: Keep DMS routes in `backend/src/routes/*` and add Accounting + Banking import routes in dedicated modules.
- Middleware:
  - `supabaseMiddleware` attaches a Supabase client to each request.
  - `authorize` handles role checks (replacing or complementing the current header‑based RBAC).
  - `errorHandler` returns consistent `{ error: { code, message } }` payloads.
- Storage Providers:
  - Implement `SupabaseStorageProvider` mirroring `LocalProvider` interface using Supabase Storage buckets.
- Database:
  - Supabase Postgres hosted project.
  - Prefer separate schemas: `dms` and `accounting` for clarity and policy isolation.
  - Use RLS to protect data when accessing from client contexts; backend uses service key, with explicit checks.
- Telemetry & Logging:
  - Add request logging, performance metrics, and audit trails, mapping to DB `audit_logs` and banking import `audit_events`.

## Environment & Secrets
- Backend (Vercel Project Environment Variables):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server‑only)
- Frontend (Vite):
  - `VITE_SUPABASE_URL` (already present)
  - `VITE_SUPABASE_ANON_KEY`
- Optional:
  - `SENTRY_DSN`, `LOG_LEVEL`, `STORAGE_BUCKET_NAME` (`dms-documents` default).

## Entry Point & Wiring
- Create `server.ts` at repo root that imports `backend/src/server.ts` and re‑exports `app` as default. This satisfies Vercel detection without restructuring frontend `src/`.
- Confirm `backend/src/server.ts` mounts routes under:
  - `/api/v1/documents/*` (DMS)
  - `/api/v1/accounting/*` (Accounting services)
  - `/api/v1/banking/*` (Banking import services)
- Ensure `errorHandler` is the last middleware.

## Supabase Integration
- Supabase Client Middleware:
  - Create `backend/src/middleware/supabase.ts`:
    - Initialize client with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
    - Attach `req.supabase` and helpers (`db`, `storage`) to request.
- Storage Provider:
  - Add `backend/src/storage/providers/SupabaseProvider.ts` implementing `StorageProvider` (put/get/delete/signed URL) using a bucket `dms-documents`.
- Database Access Layer:
  - Implement simple repository functions per module to keep route handlers thin.
  - Prefer `supabase-js` for CRUD; for complex queries, use RPC or direct SQL via MCP.

## DMS Schema (Schema: `dms`)
Based on `docs/erd.md` and existing migrations (`backend/migrations/sql/001_init.sql`, `002_seed.sql`).

Tables:
- `dms.companies` (`id`, `name`, `slug`, `created_at`)
- `dms.folders` (`id`, `company_id`, `parent_id`, `name`, `slug`, `type`, `path`, `depth`, `order_index`, `metadata_json`, `created_by`, `created_at`, `updated_at`, `deleted_at`)
- `dms.documents` (`id`, `folder_id`, `name`, `ext`, `mime_type`, `size_bytes`, `storage_key`, `checksum_sha256`, `version`, `uploaded_by`, `created_at`, `updated_at`, `deleted_at`)
- `dms.permissions` (`id`, `subject_type`, `subject_id`, `folder_id`, `role`)
- `dms.tags` (`id`, `name`, `company_id`)
- `dms.document_tags` (`document_id`, `tag_id`)
- `dms.audit_logs` (`company_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata_json`, `at`)

Indexes & Constraints:
- Unique: `(company_id, parent_id, name)` on `dms.folders` excluding soft‑deleted.
- Path index on `dms.folders.path`.
- Foreign keys cascades where appropriate (logical deletes via `deleted_at`).
- Document indexes on `folder_id`, `storage_key`, `checksum_sha256`.

RLS (initial):
- Enable RLS and create policies per role on `folders`/`documents` for `select` and `insert/update/delete`.
- Backend uses service role but still enforces RBAC through `authorize`.

Seed:
- Company roots and default Countries (Zimbabwe, Botswana, Mozambique, Malawi, Angola, Zambia, South Africa).

## Accounting Schema (Schema: `accounting`)
Core financial tables to support Chart of Accounts, Journals, Ledger, Trial Balance, Reconciliation, Tax Reports, Period End.

Tables:
- `accounting.entities` (`id`, `type`, `name`, `status`, `currency`, `country`, `email`, `phone`, `notes`, `created_at`, `updated_at`)
- `accounting.accounts` (`id`, `code`, `name`, `type`, `currency`, `parent_id`, `is_active`, `created_at`)
- `accounting.journals` (`id`, `date`, `reference`, `description`, `created_by`, `created_at`)
- `accounting.journal_lines` (`id`, `journal_id`, `account_id`, `entity_id`, `debit`, `credit`, `memo`)
- `accounting.ledger_entries` (`id`, `account_id`, `journal_line_id`, `date`, `debit`, `credit`, `balance_after`, `created_at`)
- `accounting.trial_balance_snapshots` (`id`, `as_of_date`, `totals_json`, `generated_at`)
- `accounting.reconciliations` (`id`, `account_id`, `period_start`, `period_end`, `status`, `notes`, `created_by`, `created_at`)
- `accounting.tax_reports` (`id`, `period`, `report_json`, `generated_at`)
- `accounting.period_closures` (`id`, `period_start`, `period_end`, `closed_by`, `closed_at`, `notes`)

Indexes & Constraints:
- Keys: `accounts.code` unique; indexes on `journal_lines(account_id, entity_id, date)` and `ledger_entries(account_id, date)`.
- Guard rails: check constraints for non‑negative amounts; ensure `debit` XOR `credit` in `journal_lines`.

Views (optional):
- `accounting.v_trial_balance_current` aggregating debits/credits per account.
- `accounting.v_ledger_by_account` for account activity.

RLS:
- RLS policies per user role limiting access to entities and accounts; backend enforces module‑level RBAC.

## Banking Import Schema (Schema: `banking`)
Based on `docs/erd-banking.md` and `docs/openapi.yaml` banking paths.

Tables:
- `banking.import_sessions` (`id`, `user_id`, `created_at`, `file_name`, `file_hash`, `status`, `totals_json`, `mapping_template_id`)
- `banking.import_mapping_templates` (`id`, `name`, `bank`, `header_map_json`, `transforms_json`, `created_by`, `created_at`)
- `banking.import_transactions` (`id`, `session_id`, `row_index`, `date`, `description`, `amount`, `debit`, `credit`, `account_code`, `reference`, `currency`, `validation_status`, `duplicate_flag`, `excluded`, `edit_history_json`, `row_hash`)
- `banking.import_errors` (`id`, `session_id`, `row_index`, `field`, `code`, `message`)
- `banking.import_audit_events` (`id`, `session_id`, `actor_id`, `timestamp`, `action`, `details_json`)

Indexes:
- Unique (`session_id`, `row_hash`) for idempotency on transactions.
- Filtered indexes on `validation_status`, `duplicate_flag`, `excluded`.

## API Surface Alignment
Match `docs/openapi.yaml` endpoints for DMS and Banking; add Accounting endpoints for CRUD and reports.

DMS:
- `GET /companies/:companyId/tree`
- `GET /folders/:id`
- `GET /folders/:id/children`
- `POST /folders`
- `PATCH /folders/:id`
- `POST /folders/:id/move`
- `DELETE /folders/:id`
- `POST /folders/:id/template`
- `POST /folders/:id/upload`
- `GET /documents/:id`
- `PATCH /documents/:id`
- `POST /documents/:id/move`
- `DELETE /documents/:id`
- `GET /documents/:id/versions`

Accounting (new additions):
- `GET /accounting/entities` `POST /accounting/entities` `PATCH /accounting/entities/:id` `DELETE /accounting/entities/:id`
- `GET /accounting/accounts` `POST /accounting/accounts` `PATCH /accounting/accounts/:id`
- `POST /accounting/journals` `GET /accounting/journals/:id` `GET /accounting/journals`
- `GET /accounting/ledger` (by account, date range)
- `GET /accounting/trial-balance`
- `POST /accounting/reconciliations`
- `GET /accounting/tax-reports`
- `POST /accounting/period-close`

Banking Import:
- `GET /banking/import/sessions` `POST /banking/import/sessions`
- `GET /banking/import/sessions/:id`
- `POST /banking/import/sessions/:id/analyze`
- `POST /banking/import/sessions/:id/stage`
- `PATCH /banking/import/sessions/:id/rows/:rowId`
- `POST /banking/import/sessions/:id/commit`
- `GET/POST /banking/import/templates`

## Middleware & Services
- `supabaseMiddleware`: provides `req.supabase` with `.db` and `.storage` helpers.
- `authorize`: replace header mock with user/jwt claims; roles `Admin|Editor|Viewer`.
- `errorHandler`: preserve error code/message without exposing internal details.
- `uploadService` (DMS): parse multipart, store in bucket, record DB metadata, compute checksum.
- `folderService`: path updates on move with descendant cascade.
- `accountingService`: journal posting, ledger write behavio(u)r, trial balance generation.
- `bankingImportService`: CSV analysis, staging, transforms, commit to accounting destinations.

## Supabase MCP Usage Plan
- Discover projects and choose organization.
- Confirm cost, create project, or create a development branch for isolation.
- Apply migrations for `dms`, `accounting`, `banking` schemas.
- Generate TypeScript types; expose `types/supabase.ts` for shared use.
- Retrieve `API URL` and `anon key`; configure Vercel env and `.env` for local dev.
- Use project advisors to check RLS/security and performance.

## Error Handling & Resilience
- Wrap all route handlers with try/catch; forward to `errorHandler`.
- Avoid unhandled promise rejections; confirm robust error boundaries per Vercel guidance (https://vercel.com/docs/frameworks/backend/express).
- Return consistent 4xx/5xx with machine‑readable codes.

## Security Considerations
- No service keys in the frontend.
- Enable RLS; scope policies per schema.
- Validate inputs (runtime validators in `backend/src/validation/*`).
- Rate limit sensitive endpoints; audit critical actions into DB.

## Deployment & CI
- Vercel project with env vars set; `public/` serves assets.
- Optional `vercel.json` for rewrites to `/` and API under Express.
- Lint, typecheck, and minimal tests for critical services.

---

# Phased Implementation Checklist

Phase 0 — Project Setup
- [x] Create `server.ts` at repo root to export Express app for Vercel.
- [x] Add `backend/src/middleware/supabase.ts` to initialize client per request.
- [ ] Configure Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Phase 1 — Supabase Project & Migrations
- [ ] Use MCP to select org, confirm cost, and create project/branch.
- [x] Apply migrations for `dms` schema (`companies`, `folders`, `documents`, `permissions`, `tags`, `document_tags`, `audit_logs`).
- [x] Seed companies and default countries.

Phase 2 — DMS Backend Services
- [x] Implement `SupabaseStorageProvider` and wire into upload/download services.
- [x] Replace placeholder DMS routes with DB‑backed handlers and signed URLs.
- [x] Implement path updates and descendants on folder move.
- [x] Add validators for create/move/upload per `docs/openapi.yaml`.

Phase 3 — Accounting Schema & APIs
- [x] Create `accounting` tables (entities, accounts, journals, journal_lines, ledger_entries, snapshots, reconciliations, tax_reports, period_closures).
- [x] Implement journal posting and ledger write functions; trial balance view.
- [x] Add CRUD endpoints for entities and accounts; reporting endpoints.

Phase 4 — Banking Import Module
- [x] Build endpoints for sessions, analyze, stage, edit rows, commit, templates.
- [x] Implement staging transforms and idempotency via `row_hash`.
- [x] Commit staged rows to Accounting destinations; write audit events.

Phase 5 — Auth, RBAC & RLS
- [ ] Integrate Supabase Auth; map roles to application RBAC.
- [ ] Enable RLS policies per schema; test access paths.

Phase 6 — Observability & QA
- [ ] Add request logging, performance metrics, and error tracking.
- [ ] Write minimal unit/integration tests for critical services.

Phase 7 — Deployment
- [ ] Validate Express behavior on Vercel (entrypoint, error handling).
- [ ] Ensure static assets are served from `public/` only.
- [ ] Finalize environment variables and run smoke tests.

---

## Implementation Notes & Acceptance Criteria
- Express entrypoint is recognized by Vercel and exports default app.
- DMS endpoints conform to `docs/openapi.yaml`, returning real data.
- Documents are stored in Supabase Storage; signed URLs generated server‑side.
- Accounting endpoints implement journals and ledger with accurate aggregates.
- Banking import flow supports analyze → stage → edit → commit.
- RBAC enforced consistently; RLS enabled in Supabase.
- Production deploy exhibits stable scaling and proper error handling.

## Next Actions
- Create the root `server.ts` bridge file and Supabase middleware.
- Draft migrations for `accounting` and `banking` schemas under `backend/migrations/sql/`.
- Prepare environment variables and MCP steps to create/configure the Supabase project.