# Accounting Documents Shared Store

The Accounting Documents module now uses the same in-browser documents store as the DMS module by setting the namespace to `dms-documents-store`. This ensures both modules read and write to the same data source, providing a unified document tree and consistent behavior across the app.

## Key Points

- Namespace: Accounting sets `setDocumentsNamespace('dms-documents-store')` during mount.
- Data Source: The store persists to `localStorage` under the active namespace.
- RBAC: The selected role (Admin/Editor/Viewer) is persisted in `localStorage` (`user-role`) and read by both pages.
- Telemetry: Instrumented events are stored in `localStorage` under `telemetry_events` to track actions like navigation, folder CRUD, uploads, and deletions.

## Why Share the Store?

- Consistency: Both modules operate on the same folder/document hierarchy.
- Simplicity: No duplication of state or migration logic.
- Testability: Common store functions are unit tested via Vitest.

## Store APIs (Frontend)

- `getRootFolderId()`, `getFolder(id)`, `getBreadcrumb(id)`, `listChildren(folderId)`
- `createFolder(parentId, name, type?)`, `renameFolder(id, name)`, `removeFolder(id)`
- `uploadDocuments(folderId, files, uploadedBy?)`, `removeDocument(id)`
- `setDocumentsNamespace(ns)`, `getDocumentsNamespace()`, `setDataSource(source)`, `getDataSource()`
- `getAuditLogs(folderId?)`

## Telemetry Events

- Page open: `accounting_documents_open`, `dms_documents_open`
- Navigation: `*_documents_navigate` and `documents_navigate_{node|crumb}`
- View mode: `documents_view_mode`
- Folder actions: `folder_create`, `folder_rename`, `folder_delete`
- Upload actions: `upload_click`, `document_upload`
- Document deletion: `document_delete`

Telemetry is non-blocking and resilient; failures are ignored.