# Acceptance Criteria – Phases 1–6

## Navigation & Explorer
- Users navigate via breadcrumb and tree; both reflect current path.
- Context actions show based on node type and user role.
- Lazy loading for children; virtualization kicks in for large folders.

## Folder Operations
- Creating a folder sets correct `type`, `path`, and `parent_id`.
- Rename enforces unique name within the same parent.
- Move updates `parent_id` and recalculates `path` for descendants.
- Delete is soft (`deleted_at` set); restore retains lineage.

## Document Operations
- Upload supports multiple files; stores metadata and version starts at 1.
- Preview generated for PDFs/images; office docs have converter hook.
- Move updates `folder_id` and retains versions.
- Delete is soft; versions remain available for restore.

## Permissions & Security
- RBAC enforced on every endpoint: Admin > Editor > Viewer.
- Inheritance from parent folder unless explicitly overridden.
- Sharing produces time-bound links; access audited.
- Sensitive data flags restrict downloads unless elevated permission.

## Performance & Reliability
- Typical folder listing ≤ 300 ms under normal load.
- Pagination or virtualization applies to lists beyond threshold.
- Rate limiting and audit logging middleware attached to API.