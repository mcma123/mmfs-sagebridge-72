// Documents & Folders API client for DMS module
// Wraps backend endpoints under `/api/v1/documents` with type-safe interfaces
// Transforms snake_case API responses to camelCase for frontend consistency

import { getAccessToken } from './auth';

export const USE_BACKEND_STORAGE = true; // Backend storage enabled with Supabase

export type Role = 'Admin' | 'Editor' | 'Viewer';
export type NodeType = 'company' | 'country' | 'cedant' | 'category' | 'treaty_section' | 'generic';

// ============================================================================
// Frontend Types (camelCase)
// ============================================================================

export interface Folder {
  id: number;
  parentId: number | null;
  name: string;
  type: NodeType;
  path: number[]; // Converted from materialized path string "/1/42/103"
  depth: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface BreadcrumbItem {
  id: number;
  name: string;
  type: NodeType;
}

export interface DocumentItem {
  id: number;
  folderId: number;
  name: string;
  ext: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string;
  version: number;
  uploadedBy: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface DocumentWithUrl extends DocumentItem {
  signedUrl: string;
  expiresAt?: string;
}

// ============================================================================
// Backend Response Types (snake_case)
// ============================================================================

interface FolderResponse {
  id: number;
  parent_id: number | null;
  name: string;
  type: string;
  path: string; // Materialized path like "/1/42/103"
  depth: number;
  created_at: string;
  updated_at?: string;
  metadata_json?: Record<string, any>;
}

interface BreadcrumbResponse {
  id: number;
  name: string;
  type: string;
}

interface DocumentResponse {
  id: number;
  folder_id: number;
  name: string;
  ext: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256: string;
  version: number;
  uploaded_by: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
  metadata_json?: Record<string, any>;
}

// ============================================================================
// Transformation Utilities
// ============================================================================

/**
 * Convert materialized path string to array of IDs
 * Example: "/1/42/103" → [1, 42, 103]
 */
function pathStringToArray(pathStr: string): number[] {
  return pathStr
    .split('/')
    .filter(Boolean)
    .map(Number);
}

/**
 * Transform backend folder response to frontend format
 */
function transformFolder(raw: FolderResponse): Folder {
  return {
    id: raw.id,
    parentId: raw.parent_id,
    name: raw.name,
    type: raw.type as NodeType,
    path: pathStringToArray(raw.path),
    depth: raw.depth,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    metadata: raw.metadata_json,
  };
}

/**
 * Transform backend breadcrumb response to frontend format
 */
function transformBreadcrumb(raw: BreadcrumbResponse): BreadcrumbItem {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as NodeType,
  };
}

/**
 * Transform backend document response to frontend format
 */
function transformDocument(raw: DocumentResponse): DocumentItem {
  return {
    id: raw.id,
    folderId: raw.folder_id,
    name: raw.name,
    ext: raw.ext,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes,
    storageKey: raw.storage_key,
    checksumSha256: raw.checksum_sha256,
    version: raw.version,
    uploadedBy: raw.uploaded_by,
    tags: raw.tags,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    metadata: raw.metadata_json,
  };
}

let API_BASE = '/api/v1/documents';
export function setDocumentsApiBase(base: string) {
  API_BASE = base || '/api/v1/documents';
}

async function apiFetch<T>(path: string, init: RequestInit = {}, role: Role = 'Editor'): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Role': role,
    ...(init.headers || {}),
  };

  // Add JWT Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.status === 204 ? (undefined as T) : (await res.json());
}

// ============================================================================
// Folder API Functions
// ============================================================================

/**
 * Get company folder tree or subtree
 */
export async function getCompanyTree(companyId: number, folderId?: number, role: Role = 'Viewer') {
  const q = folderId ? `?folderId=${folderId}` : '';
  const response = await apiFetch<{
    companyId: number;
    folderId: number | null;
    nodes: FolderResponse[]
  }>(`/companies/${companyId}/tree${q}`, { method: 'GET' }, role);

  return {
    ...response,
    nodes: response.nodes.map(transformFolder),
  };
}

/**
 * Get folder details with breadcrumb path
 * Returns folder info and breadcrumb trail from root to this folder
 */
export async function getFolderDetails(id: number, role: Role = 'Viewer'): Promise<{
  folder: Folder;
  breadcrumb: BreadcrumbItem[];
}> {
  const response = await apiFetch<{
    folder: FolderResponse;
    breadcrumb: BreadcrumbResponse[]
  }>(`/folders/${id}`, { method: 'GET' }, role);

  return {
    folder: transformFolder(response.folder),
    breadcrumb: response.breadcrumb.map(transformBreadcrumb),
  };
}

/**
 * Get children (folders and documents) of a folder with pagination
 */
export async function getFolderChildren(
  id: number,
  page = 1,
  pageSize = 100,
  role: Role = 'Viewer'
): Promise<{
  folderId: number;
  page: number;
  pageSize: number;
  folders: Folder[];
  documents: DocumentItem[];
}> {
  const q = `?page=${page}&pageSize=${pageSize}`;
  const response = await apiFetch<{
    folderId: number;
    page: number;
    pageSize: number;
    folders: FolderResponse[];
    documents: DocumentResponse[]
  }>(`/folders/${id}/children${q}`, { method: 'GET' }, role);

  return {
    folderId: response.folderId,
    page: response.page,
    pageSize: response.pageSize,
    folders: response.folders.map(transformFolder),
    documents: response.documents.map(transformDocument),
  };
}

/**
 * Create a new folder
 */
export async function createFolder(
  payload: { parent_id: number; name: string; type: NodeType | string },
  role: Role = 'Editor'
): Promise<Folder> {
  const response = await apiFetch<FolderResponse>(
    `/folders`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
  return transformFolder(response);
}

/**
 * Create multiple folders in batch (recursive folder structure)
 */
export async function batchCreateFolders(
  rootFolderId: number,
  folderPaths: string[],
  role: Role = 'Editor'
): Promise<{ folderMap: Record<string, number> }> {
  const response = await apiFetch<{ folderMap: Record<string, number> }>(
    `/folders/batch`,
    {
      method: 'POST',
      body: JSON.stringify({ rootFolderId, folderPaths })
    },
    role
  );
  return response;
}

/**
 * Update folder name or metadata
 */
export async function updateFolder(
  id: number,
  payload: { name?: string; metadata?: any },
  role: Role = 'Editor'
): Promise<Folder> {
  const response = await apiFetch<FolderResponse>(
    `/folders/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    role
  );
  return transformFolder(response);
}

/**
 * Move folder to a new parent
 */
export async function moveFolder(
  id: number,
  payload: { newParentId: number },
  role: Role = 'Editor'
): Promise<Folder> {
  const response = await apiFetch<FolderResponse>(
    `/folders/${id}/move`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
  return transformFolder(response);
}

/**
 * Soft delete a folder (marks as deleted, doesn't remove from DB)
 */
export async function deleteFolder(id: number, role: Role = 'Editor'): Promise<void> {
  return apiFetch<void>(`/folders/${id}`, { method: 'DELETE' }, role);
}

/**
 * Apply template structure to folder
 */
export async function applyTemplate(id: number, role: Role = 'Editor'): Promise<{ applied: boolean }> {
  return apiFetch<{ applied: boolean }>(`/folders/${id}/template`, { method: 'POST' }, role);
}

// ============================================================================
// Document API Functions
// ============================================================================

/**
 * Upload files to a folder
 * Returns array of created documents with metadata
 */
export async function uploadToFolder(
  folderId: number,
  files: File[],
  role: Role = 'Editor'
): Promise<{
  folderId: number;
  uploaded: DocumentItem[];
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'X-Role': role,
    // Note: Don't set Content-Type for FormData, browser will set it with boundary
  };

  // Add JWT Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/folders/${folderId}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload files: ${res.status} ${res.statusText}`);
  }

  const response = await res.json() as {
    folderId: number;
    uploaded: DocumentResponse[]
  };

  return {
    folderId: response.folderId,
    uploaded: response.uploaded.map(transformDocument),
  };
}

/**
 * Get document metadata with signed URL
 */
export async function getDocument(id: number, role: Role = 'Viewer'): Promise<DocumentWithUrl> {
  const response = await apiFetch<DocumentResponse & { signed_url: string }>(
    `/documents/${id}`,
    { method: 'GET' },
    role
  );

  return {
    ...transformDocument(response),
    signedUrl: response.signed_url,
  };
}

/**
 * Update document name, tags, or metadata
 */
export async function updateDocument(
  id: number,
  payload: { name?: string; tags?: string[]; metadata?: any },
  role: Role = 'Editor'
): Promise<DocumentItem> {
  const response = await apiFetch<DocumentResponse>(
    `/documents/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    role
  );
  return transformDocument(response);
}

/**
 * Move document to a different folder
 */
export async function moveDocument(
  id: number,
  payload: { targetFolderId: number },
  role: Role = 'Editor'
): Promise<DocumentItem> {
  const response = await apiFetch<DocumentResponse>(
    `/documents/${id}/move`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
  return transformDocument(response);
}

/**
 * Soft delete a document
 */
export async function deleteDocument(id: number, role: Role = 'Editor'): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, { method: 'DELETE' }, role);
}

/**
 * List all versions of a document
 */
export async function listDocumentVersions(id: number, role: Role = 'Viewer'): Promise<Array<{
  version: number;
  documentId: number;
  createdAt: string;
}>> {
  const response = await apiFetch<Array<{
    version: number;
    document_id: number;
    created_at: string;
  }>>(`/documents/${id}/versions`, { method: 'GET' }, role);

  return response.map(v => ({
    version: v.version,
    documentId: v.document_id,
    createdAt: v.created_at,
  }));
}

// ============================================================================
// File Download & View Functions
// ============================================================================

/**
 * Download a document file from backend
 * Returns a Blob that can be used to create download links or save to disk
 *
 * Usage:
 *   const blob = await downloadDocument(docId, role);
 *   const url = URL.createObjectURL(blob);
 *   const a = document.createElement('a');
 *   a.href = url;
 *   a.download = 'filename.pdf';
 *   a.click();
 */
export async function downloadDocument(id: number, role: Role = 'Viewer'): Promise<Blob> {
  if (!USE_BACKEND_STORAGE) {
    throw new Error('Backend storage not enabled. Use in-memory blob storage from documents store.');
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'X-Role': role,
  };

  // Add JWT Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to download document: ${res.status} ${res.statusText}`);
  }

  return await res.blob();
}

/**
 * Get a signed URL for viewing/downloading a document
 * Returns a temporary URL valid for 1 hour that can be opened in browser
 *
 * Usage:
 *   const { signedUrl } = await getDocumentUrl(docId, role);
 *   window.open(signedUrl, '_blank'); // Open in new tab
 */
export async function getDocumentUrl(
  id: number,
  role: Role = 'Viewer'
): Promise<{ signedUrl: string; expiresAt: string }> {
  if (!USE_BACKEND_STORAGE) {
    throw new Error('Backend storage not enabled. Use in-memory blob storage from documents store.');
  }

  const response = await apiFetch<{ signed_url: string; expires_at: string }>(
    `/documents/${id}/url`,
    { method: 'GET' },
    role
  );

  return {
    signedUrl: response.signed_url,
    expiresAt: response.expires_at,
  };
}

/**
 * Helper function to get breadcrumb from folder details
 */
export async function getBreadcrumb(folderId: number, role: Role = 'Viewer'): Promise<BreadcrumbItem[]> {
  const { breadcrumb } = await getFolderDetails(folderId, role);
  return breadcrumb;
}

/**
 * Helper to check if user has required role for an operation
 * @param requiredRole The minimum role required
 * @param userRole The user's current role
 * @returns true if user has sufficient permissions
 */
export function hasRequiredRole(requiredRole: Role, userRole: Role): boolean {
  const roleHierarchy: Record<Role, number> = {
    'Admin': 3,
    'Editor': 2,
    'Viewer': 1,
  };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}