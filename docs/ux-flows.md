# Phase 1 – Discovery & UX Flows

This document captures user roles, capabilities, and end-to-end UX flows for the redesigned Documents module with nested folders.

## Roles and Capabilities

- Admin
  - Manage companies, folders, documents, and permissions.
  - Full access to create, upload, rename, move, delete, copy, preview, download, and share.
  - Can apply templates and configure sensitive data flags.
- Editor
  - Modify content within permitted scope: create/upload/rename/move/delete/copy.
  - Can preview, download, and share within assigned folders.
- Viewer
  - Read-only access: view metadata, preview, and download permitted documents.
  - No create, upload, rename, move, or delete.

## Core Operations

- Create Folder: Choose parent, name, and `type` (company/country/cedant/category/treaty_section/generic).
- Upload File(s): Drag-and-drop or file picker; supports chunked/resumable uploads with checksum.
- Rename: Inline rename for folders/documents; validates uniqueness per parent.
- Move: Drag folders/documents to a new parent; updates `path` and breadcrumbs; permissions re-evaluated.
- Delete: Soft-delete to `deleted_at`; optional restore from trash.
- Copy: Duplicate documents (optional); retain metadata; increment version lineage if edited.
- Preview: Inline thumbnails for images/PDF; office docs via converter or external viewer.
- Download: Single or bulk; shows progress; respects sensitive flags.
- Share: Generate time-bound signed links; audit all accesses.

## UX Flows by Level

- Company → Countries → Country → Cedants → Category (Facultative | Treaty) → Treaty Sections (Quotations | Placements | Masters)
  - Each node supports create subfolder and upload.
  - Templates wizard can auto-create typical structure at Cedant/Category/Treaty Section levels.

## Navigation and Interaction

- Breadcrumbs
  - Displays the path from Company to current node.
  - Supports quick jumping to any ancestor; right-click context for actions.
- Tree View
  - Lazy loads children; virtualized for large lists.
  - Expand/collapse with keyboard or mouse.
- Keyboard Shortcuts
  - `Enter` open, `Backspace` go up, `Ctrl+N` new folder, `Ctrl+U` upload, `F2` rename.
- Drag-and-Drop
  - Drag files onto a folder to upload.
  - Drag nodes to move; shows allowed targets based on permissions.

## Error and Empty States

- Empty folder: Encouraging prompt with quick actions.
- Errors: Network, permission denied, name conflict, invalid type; retry and help links.
- Bulk actions: Multi-select for move/delete/tag; shows aggregated progress and error breakdown.

## Performance Goals

- Typical folder list/load ≤ 300 ms.
- Pagination or virtualization for large trees.
- Debounced search; incremental fetching for metadata-heavy nodes.

## Deliverables

- Wireframes: See `docs/wireframes.md`.
- Click-through prototype: See `frontend/index.html` static explorer.
- Acceptance criteria: See `docs/acceptance-criteria.md`.