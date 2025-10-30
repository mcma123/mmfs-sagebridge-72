# Accounting System – Documents Module Integration Plan

This plan delivers an identical Documents module inside the Accounting system, mirroring the existing DMS Documents experience. It stages work to first achieve feature parity with local storage, then prepares clean integration with a real database and APIs.

---

## Phase 0: Goals, Assumptions, Scope

- Goals
  - Provide an Accounting Documents module that is functionally and visually identical to the DMS Documents module.
  - Integrate it within Accounting navigation and routes so it feels native to Accounting.
  - Prepare for future backend/database wiring without disrupting current UX.
- Assumptions
  - Current DMS Documents UI lives in `src/pages/dms/Documents.tsx` and uses `src/lib/store/documents.ts` (localStorage)
  - Accounting hub lives in `src/pages/Accounting.tsx` with routes defined in `src/App.tsx` under `/accounting/*`.
  - No immediate backend is required; database linkage will follow in later phases.
- Out of Scope (for initial parity)
  - New features beyond what DMS Documents already provides.
  - Changing visual design or UX flows; the intent is to duplicate “as-is”.

---

## Phase 1: Discovery & Acceptance Criteria

- Inventory the DMS Documents feature set
  - Navigation: breadcrumb, folder tree/list, grid/list toggle, open/rename/move/delete.
  - Actions: create folders at any level; upload files; delete folders/documents; view metadata; simple search.
  - Permissions: role-gated actions (Admin/Editor/Viewer) enforced in UI.
- Define acceptance criteria for Accounting Documents
  - Accounting route `GET /accounting/documents` renders an identical explorer UI.
  - Deep navigation works: `/accounting/documents/:folderId` mirrors `/dms/documents/:folderId`.
  - All folder/document operations behave identically (create, upload, rename, delete, move).
  - State is isolated from DMS (no cross-contamination of localStorage unless shared by design).
  - Future: Both modules can point to the same backend schema with appropriate scoping.

---

## Phase 2: Architecture & Code Organization

- Option A (Fastest: Clone, then converge later)
  - Create `src/pages/accounting/Documents.tsx` by cloning `src/pages/dms/Documents.tsx`.
  - Replace layout wrapper (`DMSLayout`) with `MainLayout` (or accounting layout) to blend into Accounting.
  - Keep using `src/lib/store/documents.ts`, but namespace localStorage keys to avoid mixing instances.
- Option B (Preferred: Shared feature extraction)
  - Extract a reusable feature package under `src/features/documents/`:
    - `components/` (Explorer, Toolbar, Breadcrumb, List/Grid, Details)
    - `hooks/` (useExplorerState, useSearch, useUploads)
    - `store/` (adapter that can swap localStorage or API)
  - Make `src/pages/dms/Documents.tsx` and `src/pages/accounting/Documents.tsx` thin wrappers that configure layout, routes, and context while using the shared feature.
- Decision & Rationale
  - Start with Option A to deliver parity quickly.
  - Plan a short refactor to Option B before backend linkage to minimize duplication and simplify API wiring.

---

## Phase 3: Routing & Navigation Integration

- Add Accounting Documents routes in `src/App.tsx`
  - `Route path="/accounting/documents" element={<AccountingDocuments />} />`
  - `Route path="/accounting/documents/:folderId" element={<AccountingDocuments />} />`
- Update Accounting hub page `src/pages/Accounting.tsx`
  - Add a module card titled “Documents” with the same icon and description style as DMS.
  - Card route should navigate to `/accounting/documents`.
- Confirm navigation consistency
  - Breadcrumb, back navigation, and deep links resolve to Accounting paths.

---

## Phase 4: UI & Layout Parity

- Clone and adapt DMS Documents UI
  - Replace `DMSLayout` with `MainLayout` (or equivalent accounting layout) while keeping identical content grid.
  - Preserve component structure: toolbar, search, grid/list toggle, folder tiles, documents list, details panel.
- Themes & styles
  - Ensure Accounting uses the same theme tokens/components (`@/components/ui/*`).
  - Validate spacing, icons, and typography match DMS.
- Accessibility & responsiveness
  - Verify keyboard navigation, focus states, and responsive breakpoints mirror DMS behavior.

---

## Phase 5: State Management & Namespacing

- Current store: `src/lib/store/documents.ts` (localStorage)
  - Introduce a module context or namespace key (`"accounting-documents-store"`) to isolate Accounting data from DMS (`"dms-documents-store"`).
  - Wrap store helpers with a context provider to select namespace based on route (`dms` vs `accounting`).
- Data seeding (optional)
  - Provide a one-time seed to bootstrap Accounting root folder (e.g., `Company → Countries → Cedants → Category → Treaty Sections`).
- Migration strategy (if DMS data should be shared)
  - If Accounting must see the same tree as DMS, configure both modules to read/write the same namespace.
  - If separation is desired, keep distinct namespaces but plan a backend-level unification later.

---

## Phase 6: Backend & Database Readiness (Future)

- Schema (shared for DMS and Accounting)
  - `companies(id, name, slug, created_at)`
  - `folders(id, company_id, parent_id, name, type, path, depth, order_index, metadata_json, created_by, created_at, updated_at, deleted_at)`
  - `documents(id, folder_id, name, ext, mime_type, size_bytes, storage_key, checksum_sha256, version, uploaded_by, created_at, updated_at, deleted_at)`
  - `permissions(id, subject_type, subject_id, folder_id, role)`
- API endpoints (versioned)
  - Base: `/api/v1/documents`
  - Folders: `GET /companies/:companyId/tree`, `GET /folders/:id`, `GET /folders/:id/children`, `POST /folders`, `PATCH /folders/:id`, `POST /folders/:id/move`, `DELETE /folders/:id`
  - Documents: `POST /folders/:id/upload`, `GET /documents/:id`, `PATCH /documents/:id`, `POST /documents/:id/move`, `DELETE /documents/:id`, `GET /documents/:id/versions`, `POST /documents/:id/restore/:version`
  - Search: `GET /search?q=...` with scope filters
- Client integration plan
  - Add an API adapter in the shared store to switch between Local and Remote modes per module.
  - Introduce a `DataSource` config (LocalStorage | API) passed by the page wrapper.
  - Implement optimistic UI with server reconciliation for uploads/moves/renames.
- Migration from local to DB
  - Export local data to a temporary JSON; write a one-time import job to seed DB.
  - Maintain ID mapping for folders/documents to preserve paths and breadcrumbs.

---

## Phase 7: Permissions & Security (Future)

- RBAC roles: Admin, Editor, Viewer; enforced server-side and reflected in UI.
- Inheritance model: child nodes inherit permissions from parent unless overridden.
- Sharing: time-limited signed links for documents; audit all actions.
- Compliance: encryption at rest (provider), TLS in transit, anti-virus scanning hooks.

---

## Phase 8: Testing Strategy

- Unit tests
  - Store namespacing logic (accounting vs dms).
  - Breadcrumb and path calculations; folder/document operations.
- Integration tests
  - Accounting routes render and navigate (`/accounting/documents`, `/accounting/documents/:folderId`).
  - CRUD flows: create folder, upload file, rename/move/delete.
- E2E tests
  - Cross-module isolation: ensure actions in Accounting do not alter DMS unless configured to share.
  - Visual parity checks (snapshots) between Accounting Documents and DMS Documents.

---

## Phase 9: Rollout & Monitoring

- Progressive rollout via feature flags (show/hide Accounting Documents tile).
- Add lightweight telemetry (page views, action counts) to validate usage.
- Provide fallback: link users to DMS Documents if Accounting module is disabled.

---

## Phase 10: Documentation & Training

- Update README or product docs describing Accounting Documents entry point and routes.
- Add an admin quick-start covering seeding, permissions, and expected flows.
- Include troubleshooting for common upload and navigation issues.

---

## Phase 11: Acceptance Criteria

- Accounting Documents renders identically to DMS Documents (same UI components, behaviors, and shortcuts).
- Routes `/accounting/documents` and `/accounting/documents/:folderId` work with deep linking and breadcrumb.
- Local state is correctly namespaced (no accidental data mixing with DMS unless intentionally shared).
- Refactor path prepared to use a shared feature package and API adapter.
- Clear documentation exists for how to toggle between local and API-backed data.

---



---

## Implementation Notes & File References

- Key files
  - DMS UI: `src/pages/dms/Documents.tsx`
  - Store: `src/lib/store/documents.ts`
  - Accounting hub: `src/pages/Accounting.tsx`
  - Routes: `src/App.tsx`
- New files to introduce (Option A)
  - `src/pages/accounting/Documents.tsx` (clone of DMS page, `MainLayout` wrapper)
- Refactor targets (Option B)
  - `src/features/documents/*` shared components, hooks, and store adapter
- LocalStorage namespacing
  - DMS: `dms-documents-store`
  - Accounting: `accounting-documents-store`

---

## Risks & Mitigations

- Code duplication drift (Option A)
  - Mitigation: Time-box the clone; schedule shared extraction early.
- Data mixing between modules
  - Mitigation: Enforce explicit store namespaces and validate via tests.
- Backend integration complexity
  - Mitigation: Adopt a store adapter pattern to swap Local vs API seamlessly.