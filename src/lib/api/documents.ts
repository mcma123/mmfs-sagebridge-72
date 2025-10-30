// Documents & Folders API client stubs (Phase 4)
// These functions wrap the backend placeholders under `/api/v1/documents`.
// They add an `X-Role` header to simulate RBAC and return typed results.

export type Role = 'Admin' | 'Editor' | 'Viewer';

const BASE = '/api/v1/documents';

async function apiFetch<T>(path: string, init: RequestInit = {}, role: Role = 'Editor'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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