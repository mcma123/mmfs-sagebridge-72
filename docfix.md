DocFix Plan: Accounting Documents Module (Identical to DMS) with Shared Store

Overview
- Build a full Documents module inside the Accounting system that is feature-identical to the DMS Documents module.
- Use a shared database/schema and storage provider so both modules operate on the same source of truth.
- Keep modules independent in UX, routing, and permissions; synchronize via shared APIs/events rather than simple hyperlinks.

Guiding Principles
- Single source of truth: documents, folders, metadata, versions, permissions live in one shared store.
- Module independence: Accounting and DMS have their own routes, layouts, and role mappings.
- Shared code where it matters: extract common API/store logic and reuse in both modules.
- Parity-first: UI/UX and behaviors match DMS; no regressions.

Phases & Deliverables

Phase 0 — Discovery & Alignment
- Inventory DMS Documents feature set (list/search/filter, folder ops, upload, versioning, metadata, preview, share).
- Map current API surface from `docs/openapi.yaml` and backend routes; identify storage adapters under `backend/src/storage`.
- Decide on shared code extraction boundaries (API client, store hooks, validators) and context differences (`dms` vs `accounting`).
- Deliverables: architecture diagram, scope doc, parity checklist.

Phase 1 — Domain & Data Model Readiness
- Validate DB schema supports cross-module usage (add `app_context` or `module_origin` when helpful, non-breaking).
- Confirm indexing for queries used by both modules (by folder, owner, tags, created_at, status).
- Ensure permission model can map Accounting roles to document ACLs (role-to-permission matrix).
- Deliverables: schema notes, indexes list, permission mapping.

Phase 2 — Backend: Accounting Documents Service
- Create Accounting-specific routes mirroring DMS under `backend/src/routes/accounting/documents.*`.
- Implement service layer wrappers that reuse shared storage/provider logic with a context parameter (e.g., `{ context: 'accounting' }`).
- Apply Accounting middleware for auth/role checks; wire validators in `backend/src/validation`.
- Maintain audit trails: who did what, in which module; store context on every write.
- Acceptance: endpoints return identical payload shapes to DMS; unit tests for each route.

Phase 3 — Shared Store & Client SDK
- Extract common client logic into `src/lib/api/documentsClient.ts` and `src/lib/store/documents.ts` with a `context` switch.
- Provide typed hooks used by both modules: `useDocuments`, `useFolders`, `useUpload`, `useMetadata`, `useSearch`.
- Centralize caching, optimistic updates, error handling, and telemetry in shared layer; context controls target routes.
- Acceptance: both modules import the same store functions; no duplication of business logic.

Phase 4 — Frontend: Accounting Documents UI
- Scaffold Accounting module screens under `src/pages/accounting/documents/`:
  - `Documents.tsx` (list/grid, filters, breadcrumbs, bulk actions)
  - `FolderTree.tsx` or equivalent (if present in DMS)
  - `UploadDialog.tsx`, `DocumentViewer.tsx`, `MetadataPanel.tsx`, `ShareDialog.tsx`
- Integrate in Accounting navigation (e.g., `src/pages/Accounting.tsx` and router config): add `/accounting/documents` routes.
- Reuse shared components from DMS where possible (`src/components/ui`); otherwise copy and align styles.
- Acceptance: UI/UX parity with DMS; end-to-end flows work entirely within Accounting without navigating to DMS.

Phase 5 — Permissions & Role Mapping
- Define Accounting roles (e.g., accountant, manager, auditor) to document capabilities (view, upload, edit, delete, share).
- Add route guards and UI gating consistent with DMS behavior; show disabled states where appropriate.
- Ensure server-side checks mirror client-side gating; return consistent errors.
- Acceptance: permission tests pass for both modules; unauthorized actions blocked.

Phase 6 — Sync & Consistency Strategy
- Prefer direct shared DB operations via common services; no double-write.
- For long-running tasks (large uploads, OCR, virus scan), use async jobs/queues and emit events tagged by context.
- Implement invalidation events so both modules refresh caches when changes occur (WebSocket/Server-Sent Events or polling fallback).
- Acceptance: create/update/delete in either module reflects in the other within acceptable latency.

Phase 7 — Telemetry, Auditing, Deep Links
- Extend `src/lib/telemetry.ts` to include `module_context` on events.
- Store audit trails per action with context in backend.
- Support deep links: generate URLs that open the same document in Accounting or DMS (`/accounting/documents/:id` and `/dms/documents/:id`).
- Acceptance: metrics visible per module; deep-link navigation resolves correctly in both.

Phase 8 — Testing & QA
- Unit tests: shared store functions and backend services.
- Integration/E2E: Accounting Documents UI flows (upload, rename, move, delete, preview, share, search, filter).
- Parity checks: automated assertions that payloads and behaviors match DMS for equivalent actions.
- Accessibility and performance checks; verify caching and pagination.
- Acceptance: green tests; parity checklist complete.

Phase 9 — Migration, Rollout & Docs
- Backfill `module_context` where needed without altering ownership/ACL; run data checks.
- Add feature flags for staged rollout; enable Accounting module for pilot users first.
- Update `docs/openapi.yaml` and `docs/accounting-documents-shared-store.md` to reflect new routes and shared client.
- Provide ops playbook: monitoring, alerts, rollback steps.
- Acceptance: rollout completes without regressions; DMS continues to operate unchanged.

Files & Paths (indicative)
- Backend
  - `backend/src/routes/accounting/documents.ts`
  - `backend/src/validation/documents.ts`
  - `backend/src/middleware/authAccounting.ts`
  - `backend/src/storage/*` (shared adapters)
- Frontend
  - `src/pages/accounting/documents/*.tsx`
  - `src/lib/api/documentsClient.ts`
  - `src/lib/store/documents.ts` (shared with context)
  - `src/components/ui/*` (shared components)
- Docs
  - `docs/openapi.yaml`
  - `docs/accounting-documents-shared-store.md`

Acceptance Criteria (Summary)
- Accounting has a first-class Documents module with identical features and UX to DMS.
- Both modules operate on the same documents and metadata via a shared store.
- All document operations from Accounting succeed without navigating to DMS.
- Permissions enforce correctly per Accounting roles; audit trails include module context.
- Changes made in one module are visible in the other with minimal delay.

QA Checklist
- Navigate to `/accounting/documents`; verify list/grid, filters, search, folder ops.
- Upload files; confirm versions, metadata editing, and preview work.
- Share documents; validate ACL changes and deep links in both modules.
- Perform the same steps in DMS; verify parity.
- Check telemetry and audit entries for accurate `module_context` tagging.

Risks & Mitigations
- Diverging behavior between modules: enforce reuse via shared store and parity tests.
- Permission mismatches: maintain a single RBAC mapping and cover with tests.
- Performance under shared load: add indexes, caching, pagination, and async processing.
- UI drift: centralize shared components and styles; document usage.

Rollback Strategy
- Feature-flag Accounting Documents module; disable to revert to DMS-only access.
- Keep DMS routes intact; any Accounting-specific schema fields are optional.
- Revert router entries and UI mounts in Accounting if needed.
