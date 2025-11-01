// Documents & Folders API client stubs (Phase 4)
// These functions wrap the backend placeholders under `/api/v1/documents`.
// They add an `X-Role` header to simulate RBAC and return typed results.

// ============================================================================
// BACKEND MIGRATION NOTES:
// ============================================================================
// Current State: Files are stored in memory only (lost on page refresh)
// Frontend handles file storage via blob URLs in src/lib/store/documents.ts
//
// To enable backend file storage:
// 1. Set USE_BACKEND_STORAGE = true below
// 2. Implement backend endpoints (see backend/src/routes/documents.ts):
//    - POST /folders/:id/upload - Multipart file upload
//    - GET /documents/:id/download - File download with proper headers
//    - GET /documents/:id/url - Generate signed URL for viewing
// 3. Update uploadToFolder() to use FormData
// 4. Uncomment and implement downloadDocument() and getDocumentUrl() below
// 5. Update frontend Documents.tsx to use these API functions
// ============================================================================

export const USE_BACKEND_STORAGE = false; // TODO: Set to true when backend is ready

export type Role = 'Admin' | 'Editor' | 'Viewer';

let API_BASE = '/api/v1/documents';
export function setDocumentsApiBase(base: string) {
  API_BASE = base || '/api/v1/documents';
}

async function apiFetch<T>(path: string, init: RequestInit = {}, role: Role = 'Editor'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Role': role,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.status === 204 ? (undefined as T) : (await res.json());
}

// Folders
export async function getCompanyTree(companyId: number, folderId?: number, role: Role = 'Viewer') {
  const q = folderId ? `?folderId=${folderId}` : '';
  return apiFetch<{ companyId: number; folderId: number | null; nodes: any[] }>(`/companies/${companyId}/tree${q}`, { method: 'GET' }, role);
}

export async function getFolderDetails(id: number, role: Role = 'Viewer') {
  return apiFetch<{ id: number; breadcrumb: any[] }>(`/folders/${id}`, { method: 'GET' }, role);
}

export async function getFolderChildren(id: number, page = 1, pageSize = 50, role: Role = 'Viewer') {
  const q = `?page=${page}&pageSize=${pageSize}`;
  return apiFetch<{ folderId: number; page: number; pageSize: number; folders: any[]; documents: any[] }>(`/folders/${id}/children${q}`, { method: 'GET' }, role);
}

export async function createFolder(payload: { parent_id: number; name: string; type: string }, role: Role = 'Editor') {
  return apiFetch<{ id: number; parent_id: number; name: string; type: string; path: string; depth: number }>(`/folders`, { method: 'POST', body: JSON.stringify(payload) }, role);
}

export async function updateFolder(id: number, payload: { name?: string; metadata?: any }, role: Role = 'Editor') {
  return apiFetch<{ id: number; name?: string; metadata?: any }>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, role);
}

export async function moveFolder(id: number, payload: { newParentId: number }, role: Role = 'Editor') {
  return apiFetch<{ id: number; newParentId: number; path: string; depth: number }>(`/folders/${id}/move`, { method: 'POST', body: JSON.stringify(payload) }, role);
}

export async function deleteFolder(id: number, role: Role = 'Admin') {
  return apiFetch<void>(`/folders/${id}`, { method: 'DELETE' }, role);
}

export async function applyTemplate(id: number, role: Role = 'Editor') {
  return apiFetch<{ applied: boolean }>(`/folders/${id}/template`, { method: 'POST' }, role);
}

// Documents
export async function uploadToFolder(folderId: number, files: File[], role: Role = 'Editor') {
  // Placeholder for multipart upload; backend is a stub
  // Using JSON to align with current placeholder implementation
  return apiFetch<{ folderId: number; uploaded: any[] }>(`/folders/${folderId}/upload`, { method: 'POST', body: JSON.stringify({ files: files.map(f => ({ name: f.name, size: f.size })) }) }, role);
}

export async function getDocument(id: number, role: Role = 'Viewer') {
  return apiFetch<{ id: number; signed_url: string }>(`/documents/${id}`, { method: 'GET' }, role);
}

export async function updateDocument(id: number, payload: { name?: string; tags?: string[]; metadata?: any }, role: Role = 'Editor') {
  return apiFetch<{ id: number; name?: string; tags?: string[]; metadata?: any }>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, role);
}

export async function moveDocument(id: number, payload: { targetFolderId: number }, role: Role = 'Editor') {
  return apiFetch<{ id: number; folder_id: number }>(`/documents/${id}/move`, { method: 'POST', body: JSON.stringify(payload) }, role);
}

export async function deleteDocument(id: number, role: Role = 'Editor') {
  return apiFetch<void>(`/documents/${id}`, { method: 'DELETE' }, role);
}

export async function listDocumentVersions(id: number, role: Role = 'Viewer') {
  return apiFetch<Array<{ version: number; document_id: number; created_at: string }>>(`/documents/${id}/versions`, { method: 'GET' }, role);
}

// ============================================================================
// FILE DOWNLOAD & VIEW FUNCTIONS (BACKEND STORAGE MIGRATION)
// ============================================================================
// TODO: Uncomment and use these functions when backend storage is implemented
// ============================================================================

/**
 * Download a document file from backend
 * Returns a Blob that can be used to create download links or blob URLs
 *
 * Backend implementation required:
 * - GET /documents/:id/download
 * - Return file as binary with proper Content-Type and Content-Disposition headers
 *
 * @param id Document ID
 * @param role User role for authorization
 * @returns Promise<Blob> File blob for download
 */
export async function downloadDocument(id: number, role: Role = 'Viewer'): Promise<Blob> {
  // TODO: Implement when backend is ready
  if (!USE_BACKEND_STORAGE) {
    throw new Error('Backend storage not enabled. Use in-memory blob storage from documents store.');
  }

  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    method: 'GET',
    headers: {
      'X-Role': role,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download document: ${res.status} ${res.statusText}`);
  }

  return await res.blob();
}

/**
 * Get a signed URL for viewing/downloading a document
 * Useful for opening files in new tabs or embedding in iframes
 *
 * Backend implementation required:
 * - GET /documents/:id/url
 * - Return { signed_url: string, expires_at: string }
 * - Signed URL should be valid for viewing/downloading the file
 *
 * @param id Document ID
 * @param role User role for authorization
 * @returns Promise<{ signed_url: string; expires_at: string }> Signed URL with expiration
 */
export async function getDocumentUrl(id: number, role: Role = 'Viewer'): Promise<{ signed_url: string; expires_at: string }> {
  // TODO: Implement when backend is ready
  if (!USE_BACKEND_STORAGE) {
    throw new Error('Backend storage not enabled. Use in-memory blob storage from documents store.');
  }

  return apiFetch<{ signed_url: string; expires_at: string }>(`/documents/${id}/url`, { method: 'GET' }, role);
}

/**
 * Upload files to a folder (FUTURE BACKEND VERSION)
 *
 * Backend implementation required:
 * - POST /folders/:id/upload
 * - Accept multipart/form-data with file(s)
 * - Return array of created document metadata
 *
 * @param folderId Target folder ID
 * @param files Array of File objects to upload
 * @param role User role for authorization
 * @returns Promise with upload results
 */
export async function uploadToFolderBackend(folderId: number, files: File[], role: Role = 'Editor') {
  // TODO: Implement when backend is ready
  if (!USE_BACKEND_STORAGE) {
    throw new Error('Backend storage not enabled. Use uploadDocuments from documents store.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/folders/${folderId}/upload`, {
    method: 'POST',
    headers: {
      'X-Role': role,
      // Note: Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload files: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}