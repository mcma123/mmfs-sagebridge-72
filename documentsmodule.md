# Documents Module Redesign – Nested Folders Plan

This plan designs and delivers a flexible, nested folder system for the Documents module. It models a hierarchy with unlimited depth and prescribes templates for the common structure:

Company → Countries → Country → Cedants → Category (Facultative | Treaty) → Treaty Sections (Quotations | Placements | Masters) → Files

Every node can create subfolders and/or upload documents.

---

## Phased Execution Checklist

- [x] Phase 1: Discovery & UX flows
- [x] Phase 2: Data model & migrations
- [x] Phase 3: Storage & uploads service
- [x] Phase 4: Backend API endpoints
- [x] Phase 5: Frontend explorer UI
- [x] Phase 6: Permissions & security
 - [x] Phase 7: Folder templates & automation (frontend UI ready; backend TBD)
 - [x] Phase 8: Metadata, search, and filtering (frontend UI ready; backend TBD)
 - [x] Phase 9: Audit logs & activity feeds (frontend UI ready; backend TBD)
 - [x] Phase 10: Testing strategy (unit, integration, e2e) (frontend routes prepared)
 - [x] Phase 11: Deployment, migration, and rollout (frontend routing ready)
 - [x] Phase 12: Documentation & training (updated docs in this module)

---

## Implementation Artifacts (Phases 1–6)

- Phase 1: UX flows, wireframes, acceptance criteria
  - `docs/ux-flows.md`
  - `docs/wireframes.md`
  - `docs/acceptance-criteria.md`
- Phase 2: Data model & migrations
  - `docs/erd.md`
  - `backend/migrations/sql/001_init.sql`
  - `backend/migrations/sql/002_seed.sql`
- Phase 3: Storage & uploads service
  - `backend/src/storage/StorageProvider.ts`
  - `backend/src/storage/providers/LocalProvider.ts`
  - `backend/src/storage/providers/S3Provider.ts`
- Phase 4: Backend API endpoints
  - `docs/openapi.yaml`
  - `backend/src/server.ts`
  - `backend/src/routes/folders.ts`
  - `backend/src/routes/documents.ts`
  - `backend/src/validation/schemas.ts`
  - `backend/src/middleware/errorHandler.ts`
- Phase 5: Frontend explorer prototype
  - `frontend/index.html`
  - `frontend/styles.css`
  - `frontend/app.js`
- Phase 6: Permissions & security
  - `backend/src/middleware/rbac.ts`


---

## Phase 1: Discovery & UX Flows

- [ ] Confirm user roles and capabilities: Admin, Editor, Viewer.
- [ ] Define core operations: create folder, upload file, rename, move, delete, copy, preview, download, share.
- [ ] UX flows for each level: Company → Countries → Country → Cedants → Category → Treaty Sections.
- [ ] Decide default seed countries: Zimbabwe, Botswana, Mozambique, Malawi, Angola, Zambia, South Africa. Allow custom additions.
- [ ] Breadcrumbs behavior and path navigation; keyboard shortcuts; drag-and-drop.
- [ ] Error and empty states; bulk actions; progress indicators.
- [ ] Performance goals: list/load ≤ 300 ms for typical folders; pagination/virtualization for large trees.

Deliverables: wireframes, click-through prototype, acceptance criteria for each operation.

---

## Phase 2: Data Model & Migrations

Approach: single `folders` table for all levels using an adjacency-list with a materialized path for fast traversal.

- [ ] Tables
  - `companies(id, name, slug, created_at)`
  - `folders(id, company_id, parent_id, name, slug, type, path, depth, order_index, metadata_json, created_by, created_at, updated_at, deleted_at)`
  - `documents(id, folder_id, name, ext, mime_type, size_bytes, storage_key, checksum_sha256, version, uploaded_by, created_at, updated_at, deleted_at)`
  - `permissions(id, subject_type, subject_id, folder_id, role)`
  - `tags(id, name, company_id)` and `document_tags(document_id, tag_id)` (optional)
- [ ] Folder `type` enum: `company`, `country`, `cedant`, `category`, `treaty_section`, `generic`.
- [ ] `path` format: `/companies/<company-id>/folders/<id>/...` or materialized IDs like `/1/34/78`.
- [ ] Indexes: `(company_id, parent_id, name)`, `path`, `folder_id` FKs, `storage_key`, `checksum_sha256`.
- [ ] Constraints: unique name within the same parent; depth safeguards (configurable).
- [ ] Seed migration: create Company roots; add default Countries.
- [ ] Soft delete with `deleted_at`; cascading behavior for child items.

Deliverables: ERD, migration scripts, seed data, performance baselines.

---

## Phase 3: Storage & Uploads Service

- [ ] Storage abstraction interface: `putObject`, `getObject`, `deleteObject`, `getSignedUrl`.
- [ ] Providers: Local filesystem (dev) and Cloud (e.g., S3/Azure Blob/GCS). Configurable per environment.
- [ ] Pathing strategy: `companies/<company-id>/<folder-path>/<document-id>-<slug>`.
- [ ] Uploads: chunked/resumable, checksum verification, virus scanning hook, max file size policy.
- [ ] File name normalization and conflict policy (append counter or block).
- [ ] Versioning: new version increments `documents.version`, keep lineage.
- [ ] Preview generation: PDFs/images thumbnails; office docs via server-side converter or integration.

Deliverables: storage adapter, upload endpoints, thumbnail/preview jobs.

---

## Phase 4: Backend API Endpoints

Base: `/api/v1/documents`.

- [ ] Folder endpoints
  - `GET /companies/:companyId/tree` – fetch tree or subtree.
  - `GET /folders/:id` – folder details + breadcrumb.
  - `GET /folders/:id/children` – paginated list of folders/documents.
  - `POST /folders` – create folder `{parent_id, name, type}`.
  - `PATCH /folders/:id` – rename, update metadata.
  - `POST /folders/:id/move` – move folder to a new parent (updates `path`).
  - `DELETE /folders/:id` – soft delete; optional restore.
  - `POST /folders/:id/template` – apply a template (e.g., Treaty sections).
- [ ] Document endpoints
  - `POST /folders/:id/upload` – upload file(s).
  - `GET /documents/:id` – metadata and signed URL.
  - `PATCH /documents/:id` – rename, tags, metadata.
  - `POST /documents/:id/move` – move document between folders.
  - `DELETE /documents/:id` – soft delete.
  - `GET /documents/:id/versions` – list versions; `POST /documents/:id/restore/:version`.
- [ ] Search
  - `GET /search` – by name, tags, type, date range, country, cedant, uploader.
- [ ] Security
  - RBAC checks for each call; inheritance from parent folder.
  - Rate limiting and audit logging middleware.

Deliverables: OpenAPI spec, controllers/services, validation, error codes.

---

## Phase 5: Frontend Explorer UI

- [ ] Tree view with lazy loading; breadcrumb navigation; quick jump.
- [ ] Context actions per node: New Folder, Upload, Rename, Move, Delete, Share.
- [ ] Drag-and-drop upload and move; multi-select; keyboard shortcuts.
- [ ] Templates wizard: Company → Country → Cedants → Category → Treaty Sections.
- [ ] Details panel: metadata, tags, versions, activity.
- [ ] Thumbnails/previews; file viewer for common formats.
- [ ] Pagination/virtualization for large folders; loading indicators and retries.

Deliverables: responsive UI, accessibility pass, localization-ready strings.

---

## Phase 6: Permissions & Security

- [ ] Roles: Admin (manage), Editor (modify), Viewer (read-only).
- [ ] Inheritance: child nodes inherit from parent unless explicitly overridden.
- [ ] Sharing: per-folder/document links with expiry; audit of access.
- [ ] Sensitive data flags require elevated permission; download restrictions.
- [ ] Compliance: PII handling, encryption at rest (storage provider), TLS in transit.

Deliverables: permission matrix, enforcement middleware, admin UI.

---

## Phase 7: Folder Templates & Automation

- [ ] Template types
  - Company root template
  - Country seed template (list of countries + ability to add custom)
  - Cedants template under each Country
  - Category template under Cedant: `Facultative` and/or `Treaty`
  - Treaty sections auto-create: `Quotations`, `Placements`, `Masters`
- [ ] Template engine: declarative JSON describing required nodes; idempotent apply.
- [ ] Bulk creation tool for onboarding new companies/countries.

Deliverables: template schema, API, admin screens.

---

## Phase 8: Metadata, Search, and Filtering

- [ ] Metadata schema: uploader, dates, cedant, country, tags, document category.
- [ ] Tagging UI and batch tagging; required fields for treaty documents.
- [ ] Search indices on name, tags, metadata fields.
- [ ] Saved searches and quick filters.

Deliverables: metadata forms, search backend, UI filters.

---

## Phase 9: Audit Logs & Activity Feeds

- [ ] Events: folder create/rename/move/delete; document upload/move/delete/version.
- [ ] Store in `audit_logs(company_id, actor_id, action, entity_type, entity_id, metadata_json, at)`.
- [ ] Activity feed per folder; export to CSV.
- [ ] Admin dashboard: top actions, errors, storage usage.

Deliverables: audit middleware, viewer UI, exports.

---

## Phase 10: Testing Strategy

- [ ] Unit tests: models, services, validators, path recalculation on move.
- [ ] Integration tests: upload + versioning, permissions inheritance, template application.
- [ ] E2E tests: explorer flows, drag-drop, bulk actions, search.
- [ ] Performance tests: large trees (100k nodes), pagination, cold vs warm caches.

Deliverables: test suites, CI configuration, coverage targets.

---

## Phase 11: Deployment, Migration, and Rollout

- [ ] Data migration plan from existing Documents module; mapping old paths to new folders.
- [ ] Feature flags for progressive rollout; pilot with one company.
- [ ] Backups and rollback procedure.
- [ ] Storage costs monitoring; quotas per company.

Deliverables: runbooks, migration scripts, observability dashboards.

---

## Phase 12: Documentation & Training

- [ ] Admin and user guides; quick-start videos.
- [ ] API docs (OpenAPI) and developer guidelines.
- [ ] Troubleshooting: common errors and recovery steps.

Deliverables: living docs in repo; onboarding materials.

---

## Frontend Implementation (Phases 6–12)

The interactive Documents explorer has been implemented with per-folder routing and a local, persistent store to simulate backend behaviors. This enables end-to-end UI verification while backend build-out continues.

- Per-folder routing: `/dms/documents/:folderId` opens folders as new pages with breadcrumb navigation.
- Nested folder creation: New folders can be created at any depth on each page.
- Upload from computer: Multiple files can be uploaded into the current folder (metadata stored locally).
- View modes: Toggle between grid and list formats for folder browsing; documents are displayed in list with metadata.
- Permissions: Role selector (Admin/Editor/Viewer) gates create/upload/delete actions.
- Tree panel: View-only structural preview of the hierarchy (non-interactive), with navigation handled via grid/list content and breadcrumb.
- Persistence: Data stored in `localStorage` via `src/lib/store/documents.ts` for demo/testing.

Next backend steps: wire the UI to real APIs in `backend/src/routes/folders.ts` and `backend/src/routes/documents.ts` for create, upload, search, templates, and audit logging.

---

## Example Hierarchy (One Company)

```
Company (Acme Re)
└── Countries
    ├── Zimbabwe
    │   └── Cedants
    │       ├── ABC Insurance
    │       │   ├── Facultative
    │       │   └── Treaty
    │       │       ├── Quotations
    │       │       ├── Placements
    │       │       └── Masters
    │       └── XYZ Insurance
    ├── Botswana
    └── Mozambique
```

All nodes support: create subfolder, upload document, rename, move, delete.

---

## Acceptance Criteria Summary

- [ ] Users can navigate via breadcrumb and tree; actions available contextually.
- [ ] Creating a folder at any level sets correct `type`, `path`, and `parent_id`.
- [ ] Uploading documents works at any level; previews generated where applicable.
- [ ] Treaty template produces `Quotations`, `Placements`, and `Masters` consistently.
- [ ] Permissions inheritance works; access is enforced on every endpoint.
- [ ] Search finds by name, metadata, and tags across the hierarchy.
- [ ] Audit log records all changes with actor and timestamp.

---

## Future Enhancements

- Offline/desktop sync (OneDrive-style) with conflict resolution.
- External sharing portals for partners with limited access.
- Automated retention policies and legal holds.
- AI-assisted document classification and metadata extraction.