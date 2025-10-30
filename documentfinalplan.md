# Documents Module – Multi-Company Support and Company Creation Page

## Goals

- Change any remaining references of `Acme Re` to `MMFS` in the Documents module.
- Add a Companies page to the DMS sidebar where users can create/manage companies.
- Each company has its own isolated Document Explorer (folders, documents, audit logs).
- Keep the current UX patterns (grid/list, breadcrumb, actions) consistent across companies.

## Scope

- Frontend only for now, with local storage persistence (existing demo store).
- Prepare a clean migration path to backend APIs later without breaking UI contracts.

## Architecture Overview

- Current design: a single root company folder seeded in `src/lib/store/documents.ts` with an adjacency list. All folders are stored in one map, with `path: number[]` representing a materialized path.
- Target design: support multiple companies, each with an independent tree and routes, plus a Company Manager page to create, rename, and delete companies.

## Data Model Changes (Frontend Store)

- Add a new `Company` type:
  - `id: number`
  - `name: string`
  - `createdAt: string`
  - `rootFolderId: number` (the top-level folder of the company)

-- Update `StoreShape`:
  - Replace `rootFolderId: number` with `companies: Record<number, Company>`.
  - Add `companyOrder: number[]` to keep a stable list order.
  - Keep `folders: Record<number, Folder>` and `documents: Record<number, DocumentItem>`.

- Update `Folder` interface to include `companyId: number` for filtering and scoping.

- Provide CRUD helpers:
  - `createCompany(name: string): Company`
  - `listCompanies(): Company[]`
  - `renameCompany(id: number, name: string): Company`
  - `deleteCompany(id: number): void` (soft-remove; optionally require empty tree)
  - `getCompany(id: number): Company | undefined`

- Folder/document helpers must be company-aware:
  - `getBreadcrumb(companyId: number, folderId: number)`
  - `listChildren(companyId: number, folderId: number)`
  - `createFolder(companyId: number, parentId: number, name: string, type?: NodeType)`
  - `uploadDocuments(companyId: number, folderId: number, files: File[], uploadedBy?: string)`

## Routing Changes

- New routes:
  - `/dms/companies` → Companies page (list, create, manage companies)
  - `/dms/companies/:companyId/documents` → company root Document Explorer
  - `/dms/companies/:companyId/documents/:folderId` → nested folders for that company

- Backward compatibility:
  - Keep existing `/dms/documents` routes; redirect to the first company (if any) or to `/dms/companies` when none exist.

## Sidebar Integration

- In `DMSLayout.tsx`, add a new menu item:
  - Label: `Companies`
  - Path: `/dms/companies`
  - Rationale: central place to create/manage companies.

## UI Pages & Components

- Companies Page (`src/pages/dms/Companies.tsx`):
  - Header with `Companies` title and description.
  - Toolbar: `New Company` button opens a dialog.
  - Companies list/grid with stats (folders count, documents count), actions: `Open`, `Rename`, `Delete`.
  - Clicking `Open` routes to `/dms/companies/:companyId/documents`.

- New Company Dialog (`src/components/dms/NewCompanyDialog.tsx`):
  - Name input and `Create` button.
  - On create: make `Company` + seed root folder (`Countries`), then route to company’s explorer.

- Company Document Explorer (`src/pages/dms/CompanyDocuments.tsx`):
  - Clone of current `Documents.tsx`, parameterized by `companyId`.
  - All list/create/upload/delete actions scoped by `companyId`.
  - Breadcrumb resolves using `companyId` + `folderId`.

## Seeding & Templates

- On company creation, apply a root template:
  - Create a `Countries` folder under the root.
  - Optionally seed default country list.

## Store Migration Strategy

- v1 → v2 migration (single-company → multi-company):
  - Detect old store shape (presence of `rootFolderId`).
  - Create a new `Company` record using the existing root folder as `rootFolderId`.
  - Set `companyId` on all existing folders/documents based on membership in that root path.
  - Persist in-place without losing data.
  - Already included: rename migration from `Acme Re` → `MMFS`.

## Backend Readiness (Optional)

- Plan for future APIs:
  - `GET /companies`, `POST /companies`, `PATCH /companies/:id`, `DELETE /companies/:id`.
  - `GET /companies/:id/tree`, `GET /folders/:id`, `POST /folders`, `PATCH /folders/:id`, `DELETE /folders/:id`.
  - AuthN/Z: RBAC with per-company permissions.

## Acceptance Criteria

- Companies page allows creating, renaming, deleting companies.
- Each company opens its own isolated Document Explorer with breadcrumb, grid/list, and actions.
- Existing users see `MMFS` instead of `Acme Re` without clearing storage.
- Legacy `/dms/documents` route still works (redirects or opens the default company).

## Risks & Mitigations

- Data migration errors → add unit tests for migration; keep a backup copy in localStorage (`dms-documents-store.backup`).
- Route fragmentation → implement redirects when no companies exist.
- Permissions later → design store with companyId to simplify RBAC.

## Testing Plan

- Unit: store helpers, migration from v1 to v2, template application.
- Integration: Companies page create/rename/delete, explorer navigation per company.
- E2E (playwright/cypress): multi-company navigation, uploads, renames.

## Rollout Steps

1. Implement store migration and helpers for companies.
2. Add Companies page and sidebar item.
3. Create company creation dialog and seed root structure.
4. Create company-scoped Document Explorer and wire routes.
5. Add redirects from legacy routes.
6. Write unit and integration tests.
7. Deploy and verify with sample data.

## Timeline (Estimate)

- Day 1–2: Store migration, helpers, routes.
- Day 3: Companies page + dialog.
- Day 4: Company-scoped explorer.
- Day 5: Testing, polish, and docs.

## Notes

- Keep UI consistent with existing Documents module.
- Avoid breaking changes by providing redirect compatibility.