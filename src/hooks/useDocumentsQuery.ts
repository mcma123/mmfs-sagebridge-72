// React Query hooks for DMS Documents module
// Provides query and mutation hooks for folders and documents with automatic caching and refetching

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Role, DocxContent } from '@/lib/api/documents';
import * as documentsApi from '@/lib/api/documents';

// ============================================================================
// Query Keys - Centralized for cache invalidation
// ============================================================================

export const documentKeys = {
  all: ['documents'] as const,
  folders: () => [...documentKeys.all, 'folders'] as const,
  folder: (id: number) => [...documentKeys.folders(), id] as const,
  folderDetails: (id: number) => [...documentKeys.folder(id), 'details'] as const,
  folderChildren: (id: number, page: number) => [...documentKeys.folder(id), 'children', page] as const,
  documents: () => [...documentKeys.all, 'documents'] as const,
  document: (id: number) => [...documentKeys.documents(), id] as const,
  content: (id: number) => [...documentKeys.document(id), 'content'] as const,
  companyTree: (companyId: number, folderId?: number) =>
    ['companies', companyId, 'tree', folderId] as const,
};

// ============================================================================
// Folder Query Hooks
// ============================================================================

/**
 * Get folder details with breadcrumb
 */
export function useFolder(folderId: number, role: Role = 'Viewer') {
  return useQuery({
    queryKey: documentKeys.folderDetails(folderId),
    queryFn: () => documentsApi.getFolderDetails(folderId, role),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: folderId > 0,
  });
}

/**
 * Get folder children (folders and documents) with pagination
 */
export function useFolderChildren(
  folderId: number,
  page = 1,
  pageSize = 100,
  role: Role = 'Viewer'
) {
  return useQuery({
    queryKey: documentKeys.folderChildren(folderId, page),
    queryFn: () => documentsApi.getFolderChildren(folderId, page, pageSize, role),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: folderId > 0,
  });
}

/**
 * Get company folder tree
 */
export function useCompanyTree(
  companyId: number,
  folderId?: number,
  role: Role = 'Viewer'
) {
  return useQuery({
    queryKey: documentKeys.companyTree(companyId, folderId),
    queryFn: () => documentsApi.getCompanyTree(companyId, folderId, role),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: companyId > 0,
  });
}

// ============================================================================
// Document Query Hooks
// ============================================================================

/**
 * Get document with signed URL
 */
export function useDocument(documentId: number, role: Role = 'Viewer') {
  return useQuery({
    queryKey: documentKeys.document(documentId),
    queryFn: () => documentsApi.getDocument(documentId, role),
    staleTime: 1 * 60 * 1000, // 1 minute (shorter because signed URLs expire)
    enabled: documentId > 0,
  });
}

/**
 * Get editable content for a document (DOCX / PDF)
 */
export function useDocumentContent(documentId: number, role: Role = 'Editor') {
  return useQuery({
    queryKey: documentKeys.content(documentId),
    queryFn: () => documentsApi.getDocumentContent(documentId, role),
    enabled: documentId > 0,
  });
}

// ============================================================================
// Folder Mutation Hooks
// ============================================================================

/**
 * Create a new folder
 */
export function useCreateFolder(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { parent_id: number; name: string; type: string }) =>
      documentsApi.createFolder(payload, role),
    onSuccess: (data, variables) => {
      // Invalidate parent folder's children to show new folder
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.parent_id, 1),
      });
      // Invalidate parent folder details to update child count
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderDetails(variables.parent_id),
      });
      toast.success(`Folder "${data.name}" created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create folder: ${error.message}`);
    },
  });
}

/**
 * Update folder (rename or metadata)
 */
export function useUpdateFolder(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: {
      id: number;
      payload: { name?: string; metadata?: any }
    }) => documentsApi.updateFolder(id, payload, role),
    onSuccess: (data) => {
      // Invalidate the folder's own details (updates breadcrumb)
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderDetails(data.id),
      });
      // Invalidate the folder's own children (updates current view if we're in this folder)
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(data.id, 1),
      });
      // Invalidate parent folder's children (updates parent view showing this folder)
      if (data.parentId) {
        queryClient.invalidateQueries({
          queryKey: documentKeys.folderChildren(data.parentId, 1),
        });
      }
      toast.success(`Folder updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update folder: ${error.message}`);
    },
  });
}

/**
 * Move folder to new parent
 */
export function useMoveFolder(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      newParentId,
      oldParentId
    }: {
      id: number;
      newParentId: number;
      oldParentId: number;
    }) => documentsApi.moveFolder(id, { newParentId }, role),
    onSuccess: (data, variables) => {
      // Invalidate old parent's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.oldParentId, 1),
      });
      // Invalidate new parent's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.newParentId, 1),
      });
      // Invalidate the moved folder's details
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderDetails(variables.id),
      });
      toast.success('Folder moved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to move folder: ${error.message}`);
    },
  });
}

/**
 * Delete a folder
 */
export function useDeleteFolder(role: Role = 'Admin') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number }) =>
      documentsApi.deleteFolder(id, role),
    onSuccess: (_data, variables) => {
      // Invalidate parent folder's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.parentId, 1),
      });
      toast.success('Folder deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete folder: ${error.message}`);
    },
  });
}

// ============================================================================
// Document Mutation Hooks
// ============================================================================

/**
 * Upload files to a folder
 */
export function useUploadFiles(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, files }: { folderId: number; files: File[] }) =>
      documentsApi.uploadToFolder(folderId, files, role),
    onSuccess: (data, variables) => {
      // Invalidate folder's children to show new documents
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.folderId, 1),
      });
      const count = data.uploaded.length;
      toast.success(`${count} file${count > 1 ? 's' : ''} uploaded successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload files: ${error.message}`);
    },
  });
}

/**
 * Update document metadata
 */
export function useUpdateDocument(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      folderId,
      payload
    }: {
      id: number;
      folderId: number;
      payload: { name?: string; tags?: string[]; metadata?: any }
    }) => documentsApi.updateDocument(id, payload, role),
    onSuccess: (data, variables) => {
      // Invalidate document details
      queryClient.invalidateQueries({
        queryKey: documentKeys.document(data.id),
      });
      // Invalidate folder's children to show updated document
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.folderId, 1),
      });
      toast.success('Document updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });
}

/**
 * Move document to different folder
 */
export function useMoveDocument(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      targetFolderId,
      sourceFolderId
    }: {
      id: number;
      targetFolderId: number;
      sourceFolderId: number;
    }) => documentsApi.moveDocument(id, { targetFolderId }, role),
    onSuccess: (data, variables) => {
      // Invalidate source folder's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.sourceFolderId, 1),
      });
      // Invalidate target folder's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.targetFolderId, 1),
      });
      // Invalidate document details
      queryClient.invalidateQueries({
        queryKey: documentKeys.document(variables.id),
      });
      toast.success('Document moved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to move document: ${error.message}`);
    },
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number }) =>
      documentsApi.deleteDocument(id, role),
    onSuccess: (_data, variables) => {
      // Invalidate folder's children
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.folderId, 1),
      });
      toast.success('Document deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

/**
 * Save edited document content (DOCX / PDF) and create a new version.
 * For DOCX, accepts structured DocxContent instead of HTML.
 */
export function useSaveDocumentContent(role: Role = 'Editor') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      folderId,
      docx,
      targetFormat,
    }: {
      id: number;
      folderId: number;
      docx: DocxContent;
      targetFormat: 'pdf' | 'docx';
    }) => documentsApi.saveDocumentContent(id, { docx, targetFormat }, role),
    onSuccess: (data, variables) => {
      // Invalidate document metadata (version, size, etc.)
      queryClient.invalidateQueries({
        queryKey: documentKeys.document(data.id),
      });
      // Invalidate editable content cache
      queryClient.invalidateQueries({
        queryKey: documentKeys.content(data.id),
      });
      // Invalidate folder listing so size/version are refreshed
      queryClient.invalidateQueries({
        queryKey: documentKeys.folderChildren(variables.folderId, 1),
      });
      toast.success('Document content saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save document content: ${error.message}`);
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Get breadcrumb for a folder
 */
export function useBreadcrumb(folderId: number, role: Role = 'Viewer') {
  const { data, isLoading, error } = useFolder(folderId, role);

  return {
    breadcrumb: data?.breadcrumb ?? [],
    isLoading,
    error,
  };
}
