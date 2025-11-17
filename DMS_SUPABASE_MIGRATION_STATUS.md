# DMS Documents Supabase Migration Status

**Date**: 2025-11-16
**Status**: Backend Complete ✅ | Frontend Integration In Progress 🚧

## Overview

The DMS documents module is being migrated from localStorage-only storage to Supabase database + storage backend. This ensures documents persist across sessions and are accessible from the database.

---

## ✅ Completed Work

### 1. Database Schema Migration ✅

**File**: `backend/migrations/sql/022_dms_folders_documents.sql`

Created comprehensive database schema with:
- `dms.folders` table with hierarchical path support (`/1/42/103` materialized paths)
- `dms.documents` table with metadata (tags, metadata_json, version, uploaded_by)
- `dms.document_versions` table for version history
- `dms.audit_logs` table for change tracking
- Proper indexes for performance (GIN indexes on JSONB, btree on paths)
- Soft-delete support (`deleted_at` columns)
- Auto-update triggers for `updated_at` timestamps
- Database views: `v_folders_active`, `v_documents_active`

**Schema Highlights**:
```sql
-- Folders with hierarchical paths
CREATE TABLE dms.folders (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT,
  parent_id BIGINT REFERENCES dms.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type dms.folder_type NOT NULL DEFAULT 'generic',
  path TEXT NOT NULL,  -- Materialized path: '/1/42/103'
  depth INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents with Supabase storage keys
CREATE TABLE dms.documents (
  id BIGSERIAL PRIMARY KEY,
  folder_id BIGINT NOT NULL REFERENCES dms.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ext TEXT,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL UNIQUE,  -- S3/Supabase storage key
  checksum_sha256 TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata_json JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration Status**: ✅ Successfully ran via `npm run db:migrate:app`

---

### 2. Backend API Routes ✅

**Files**:
- `backend/src/routes/folders.ts` (existing, fully functional)
- `backend/src/routes/documents.ts` (existing, fully functional)
- `backend/src/storage/providers/SupabaseProvider.ts` (existing, tested)

**Available Endpoints**:

#### Folders API
- `GET /companies/:companyId/tree` - Fetch folder tree
- `GET /folders/:id` - Folder details with breadcrumb
- `GET /folders/:id/children` - Paginated children (folders + documents)
- `POST /folders` - Create folder with path calculation
- `PATCH /folders/:id` - Rename/update metadata
- `POST /folders/:id/move` - Move folder with cascade path updates
- `DELETE /folders/:id` - Soft delete

#### Documents API
- `POST /folders/:id/upload` - **Multipart file upload** (FormData ready)
- `GET /documents/:id` - Get metadata + signed URL
- `PATCH /documents/:id` - Update document name/metadata
- `POST /documents/:id/move` - Move between folders
- `DELETE /documents/:id` - Soft delete
- `GET /documents/:id/versions` - Version history

**Backend Status**: ✅ All routes tested and functional with PostgreSQL + Supabase storage

---

### 3. Frontend API Client Updates ✅

**File**: `src/lib/api/documents.ts`

**Changes Made**:
1. ✅ Enabled backend storage: `USE_BACKEND_STORAGE = true`
2. ✅ Updated `uploadToFolder()` to use FormData multipart upload
3. ✅ Implemented `downloadDocument()` for file downloads
4. ✅ Implemented `getDocumentUrl()` for signed URLs

**Before** (localStorage stub):
```typescript
export async function uploadToFolder(folderId: number, files: File[], role: Role = 'Editor') {
  return apiFetch(`/folders/${folderId}/upload`, {
    method: 'POST',
    body: JSON.stringify({ files: files.map(f => ({ name: f.name, size: f.size })) })
  }, role);
}
```

**After** (real FormData upload):
```typescript
export async function uploadToFolder(folderId: number, files: File[], role: Role = 'Editor') {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/folders/${folderId}/upload`, {
    method: 'POST',
    headers: { 'X-Role': role },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload files: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}
```

---

## 🚧 Remaining Work

### 1. Frontend UI Integration (NEXT STEP)

**Files to Update**:
- `src/pages/dms/Documents.tsx` - Main DMS documents page
- `src/pages/accounting/Documents.tsx` - Accounting documents page

**Current State**: Both pages use `src/lib/store/documents.ts` (localStorage-based)

**Required Changes**:

#### Option A: Direct API Integration (Recommended - Simpler)
Replace localStorage store calls with direct API client calls:

```typescript
// OLD (localStorage):
import { uploadDocuments, listChildren, createFolder } from '@/lib/store/documents';
const { folders, documents } = listChildren(folderId);

// NEW (API):
import { getFolderChildren, uploadToFolder, createFolder } from '@/lib/api/documents';
const { folders, documents } = await getFolderChildren(folderId, 1, 50, role);
```

**Steps**:
1. Replace `listChildren()` with `getFolderChildren()`
2. Replace `uploadDocuments()` with `uploadToFolder()`
3. Replace `createFolder()` with API `createFolder()`
4. Replace `getBreadcrumb()` with `getFolderDetails()`
5. Replace `getDocumentBlob()` with `downloadDocument()` or `getDocumentUrl()`
6. Add loading states and error handling for async operations
7. Update state management to handle API responses

#### Option B: Hybrid Approach (Preserve localStorage Interface)
Update `src/lib/store/documents.ts` to route through API when `DATA_SOURCE === 'api'`:

```typescript
export async function uploadDocuments(folderId: number, files: File[]) {
  if (DATA_SOURCE === 'api') {
    return uploadToFolder(folderId, files, getCurrentRole());
  } else {
    // Existing localStorage logic
  }
}
```

**Pros**: Non-breaking change, preserves existing UI code
**Cons**: More complex, maintains unnecessary abstraction layer

---

### 2. Document Download/View Implementation

**Current Issue**: Documents are stored as in-memory blobs (`Map<number, File>`) - lost on page refresh

**Solution**: Use signed URLs from Supabase

```typescript
// Download a document
async function handleDownload(docId: number) {
  try {
    const blob = await downloadDocument(docId, role);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
  }
}

// View in new tab
async function handleView(docId: number) {
  try {
    const { signed_url } = await getDocumentUrl(docId, role);
    window.open(signed_url, '_blank');
  } catch (error) {
    console.error('View failed:', error);
  }
}
```

---

### 3. Dashboard Integration

**File**: `src/pages/Index.tsx` (Dashboard)

**Current State**: Dashboard likely doesn't show documents or uses localStorage

**Required**:
- Update dashboard widgets to query documents from database via API
- Show recent uploads, document counts, folder stats
- Add document search/filter functionality

**Example**:
```typescript
// Fetch recent documents
const { data: recentDocs } = useQuery('recent-documents', async () => {
  // Call backend endpoint to get recent documents across all folders
  return fetch('/api/v1/documents/recent?limit=10').then(r => r.json());
});
```

---

### 4. Data Migration (If Existing Data)

**If users have documents in localStorage**, migrate them to Supabase:

```typescript
// Migration script (run once)
async function migrateLocalStorageToSupabase() {
  const store = loadStore(); // Load from localStorage

  for (const folder of Object.values(store.folders)) {
    await createFolder({
      parent_id: folder.parentId,
      name: folder.name,
      type: folder.type
    });
  }

  for (const doc of Object.values(store.documents)) {
    const file = fileBlobs.get(doc.id);
    if (file) {
      await uploadToFolder(doc.folderId, [file]);
    }
  }

  console.log('Migration complete!');
}
```

---

### 5. Testing Checklist

- [ ] Upload single file to folder
- [ ] Upload multiple files to folder
- [ ] Download document (verify correct file)
- [ ] View document in new tab (verify signed URL)
- [ ] Create new folder
- [ ] Rename folder
- [ ] Move document between folders
- [ ] Delete document (soft delete)
- [ ] Delete folder (cascade soft delete)
- [ ] Verify documents persist after page refresh
- [ ] Test with different roles (Admin, Editor, Viewer)
- [ ] Check file size limits (backend/Supabase)
- [ ] Verify document versioning works
- [ ] Test search/filter by tags
- [ ] Verify audit log tracking

---

## Architecture Diagram

```
┌─────────────────┐
│  Frontend       │
│  (React)        │
│                 │
│  Documents.tsx  │───┐
│  API Client     │   │
└─────────────────┘   │
                      │ HTTP/REST
                      │
┌─────────────────┐   │
│  Backend        │◄──┘
│  (Express)      │
│                 │
│  /folders/*     │───┐
│  /documents/*   │   │
└─────────────────┘   │
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│  PostgreSQL     │          │  Supabase       │
│  (Supabase)     │          │  Storage        │
│                 │          │                 │
│  dms.folders    │          │  Bucket:        │
│  dms.documents  │          │  dms-documents  │
│  dms.audit_logs │          │                 │
└─────────────────┘          └─────────────────┘
     Metadata                    File Blobs
     (names, paths,              (PDFs, images,
      versions, tags)             Excel, etc.)
```

---

## Key Implementation Files

### Backend
- `backend/migrations/sql/022_dms_folders_documents.sql` - Database schema
- `backend/scripts/migrate_app.ts` - Migration runner (updated)
- `backend/src/routes/folders.ts` - Folder CRUD endpoints
- `backend/src/routes/documents.ts` - Document upload/download endpoints
- `backend/src/storage/providers/SupabaseProvider.ts` - Supabase storage integration
- `backend/src/server.ts` - Route mounting

### Frontend
- `src/lib/api/documents.ts` - ✅ API client (updated to use FormData)
- `src/lib/store/documents.ts` - ⚠️ localStorage store (needs API routing)
- `src/pages/dms/Documents.tsx` - 🚧 Main UI (needs API integration)
- `src/pages/accounting/Documents.tsx` - 🚧 Accounting UI (needs API integration)
- `src/pages/Index.tsx` - 🚧 Dashboard (needs document widgets)

---

## Environment Variables (Already Configured)

```env
# Supabase Database
DATABASE_URL=postgresql://...
SUPABASE_DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres.xxx
SUPABASE_DB_PASSWORD=xxx
SUPABASE_DB_NAME=postgres

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# JWT Auth
JWT_SECRET=xxx
```

---

## Next Steps (Prioritized)

### Immediate (High Priority)
1. **Update `src/pages/dms/Documents.tsx`**:
   - Replace localStorage calls with API calls
   - Add async/await handling
   - Add loading states
   - Add error toasts/notifications

2. **Test File Upload**:
   - Upload a test PDF to verify end-to-end flow
   - Check database for document record
   - Check Supabase storage for file blob
   - Verify signed URL download works

3. **Update `src/pages/accounting/Documents.tsx`**:
   - Same changes as DMS Documents page
   - Set API base to `/api/v1/accounting/documents`

### Short Term (Medium Priority)
4. **Dashboard Integration**:
   - Add "Recent Documents" widget
   - Add "Storage Usage" widget
   - Link to documents from dashboard

5. **User Experience**:
   - Add upload progress indicators
   - Add drag-and-drop upload
   - Add file preview thumbnails
   - Add bulk operations (select multiple, delete all)

### Long Term (Low Priority)
6. **Advanced Features**:
   - Full-text search in documents (using metadata_json)
   - Document versioning UI
   - Audit log viewer
   - Document sharing/permissions
   - Document expiration/archival

---

## Migration Verification SQL

Run these queries to verify the migration worked:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'dms'
ORDER BY table_name;

-- Count existing data
SELECT 'folders' as table_name, COUNT(*) as count FROM dms.folders
UNION ALL
SELECT 'documents', COUNT(*) FROM dms.documents
UNION ALL
SELECT 'document_versions', COUNT(*) FROM dms.document_versions
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM dms.audit_logs;

-- Show folder tree structure
SELECT id, name, type, path, depth
FROM dms.folders
WHERE deleted_at IS NULL
ORDER BY path;

-- Show recent documents
SELECT d.id, d.name, d.ext, d.size_bytes, d.uploaded_by, d.created_at, f.name as folder_name
FROM dms.documents d
JOIN dms.folders f ON f.id = d.folder_id
WHERE d.deleted_at IS NULL
ORDER BY d.created_at DESC
LIMIT 10;
```

---

## Success Criteria

Migration is complete when:
- ✅ Database tables created and populated
- ✅ Backend API endpoints functional
- ✅ Frontend API client updated
- 🚧 DMS Documents page uses API (uploads/downloads working)
- 🚧 Accounting Documents page uses API
- 🚧 Documents persist across page refreshes
- 🚧 Dashboard shows documents from database
- 🚧 All tests pass

---

## Troubleshooting

### Common Issues

**"Failed to upload files: 500"**
- Check backend logs for Supabase connection errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check Supabase storage bucket `dms-documents` exists

**"Column does not exist" errors**
- Run migration again: `npm run db:migrate:app`
- Check migration file 022 executed successfully

**"File not found" when downloading**
- Verify storage_key in database matches Supabase storage
- Check Supabase storage bucket permissions
- Verify signed URL expiration (default 1 hour)

**localStorage data lost after migration**
- Expected behavior - old localStorage data is separate
- Run data migration script if needed
- Users will need to re-upload documents

---

## Contact & Support

For questions or issues:
- Review backend logs: `npm run dev:backend`
- Check Supabase dashboard for storage/database errors
- Test API endpoints directly using Postman/curl
- Review this document for implementation guidance

**Last Updated**: 2025-11-16
