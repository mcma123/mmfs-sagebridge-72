import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Search, FolderOpen, FileText, Download, Eye, Trash2, Filter, ChevronRight, Plus, Move, Pencil, Share2, LayoutGrid, List, Loader2 } from 'lucide-react';
import {
  useBreadcrumb,
  useFolderChildren,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useMoveFolder,
  useUploadFiles,
  useDeleteDocument,
  useMoveDocument,
} from '@/hooks/useDocumentsQuery';
import { getDocumentUrl, downloadDocument, setDocumentsApiBase } from '@/lib/api/documents';
import { trackEvent } from '@/lib/telemetry';

type Role = 'Admin' | 'Editor' | 'Viewer';

const AccountingDocuments: React.FC = () => {
  const navigate = useNavigate();
  const { folderId: folderIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState<Role>('Editor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set API base for accounting documents module
  useEffect(() => {
    setDocumentsApiBase('/api/v1/accounting/documents');
    trackEvent('accounting_documents_open', { module: 'accounting' });
    // Restore persisted role if available
    const savedRole = localStorage.getItem('user-role') as Role | null;
    if (savedRole === 'Admin' || savedRole === 'Editor' || savedRole === 'Viewer') {
      setRole(savedRole);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('user-role', role);
  }, [role]);

  // Default to folder ID 1 (root company folder) if not specified
  const currentFolderId = useMemo(() => {
    const id = folderIdParam ? Number(folderIdParam) : 1;
    return Number.isFinite(id) && id > 0 ? id : 1;
  }, [folderIdParam]);

  useEffect(() => {
    trackEvent('accounting_documents_navigate', { module: 'accounting', folderId: currentFolderId });
  }, [currentFolderId]);

  // Fetch folder data using React Query
  const { breadcrumb, isLoading: breadcrumbLoading } = useBreadcrumb(currentFolderId, role);
  const {
    data: childrenData,
    isLoading: childrenLoading,
    error: childrenError,
  } = useFolderChildren(currentFolderId, 1, 100, role);

  const current = breadcrumb[breadcrumb.length - 1] ?? { id: 1, name: 'Documents', type: 'company' as const };
  const canEdit = role === 'Admin' || role === 'Editor';

  const folders = childrenData?.folders ?? [];
  const documents = childrenData?.documents ?? [];

  // Mutations
  const createFolderMutation = useCreateFolder(role);
  const updateFolderMutation = useUpdateFolder(role);
  const deleteFolderMutation = useDeleteFolder(role);
  const moveFolderMutation = useMoveFolder(role);
  const uploadFilesMutation = useUploadFiles(role);
  const deleteDocumentMutation = useDeleteDocument(role);
  const moveDocumentMutation = useMoveDocument(role);

  const viewMode = (searchParams.get('view') === 'list' ? 'list' : 'grid') as 'grid' | 'list';
  const setViewMode = (view: 'grid' | 'list') => {
    const next = new URLSearchParams(searchParams);
    next.set('view', view);
    setSearchParams(next);
    trackEvent('documents_view_mode', { module: 'accounting', view });
  };

  const getFileIcon = (type: string) => {
    return <FileText className="h-5 w-5" />;
  };

  const getFileColor = (type?: string) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'pdf':
        return 'text-red-600 dark:brightness-110';
      case 'xlsx':
      case 'excel':
        return 'text-green-600 dark:brightness-110';
      case 'docx':
      case 'word':
        return 'text-blue-600 dark:brightness-110';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  };

  function navigateToNode(folderId: number) {
    trackEvent('documents_navigate_node', { module: 'accounting', folderId });
    navigate(`/accounting/documents/${folderId}`);
  }

  function navigateToCrumb(folderId: number) {
    trackEvent('documents_navigate_crumb', { module: 'accounting', folderId });
    navigate(`/accounting/documents/${folderId}`);
  }

  async function addFolder() {
    if (!canEdit) return;
    const name = window.prompt('New folder name:');
    if (!name) return;
    trackEvent('folder_create', { module: 'accounting', parentId: currentFolderId, name });

    try {
      await createFolderMutation.mutateAsync({
        parent_id: currentFolderId,
        name,
        type: 'generic',
      });
    } catch (error) {
      // Error toast is handled by the mutation
      console.error('Failed to create folder:', error);
    }
  }

  async function renameCurrent() {
    if (!canEdit) return;
    const name = window.prompt('Rename to:', current?.name ?? '');
    if (!name) return;
    trackEvent('folder_rename', { module: 'accounting', id: current?.id, name });

    try {
      if (current) {
        await updateFolderMutation.mutateAsync({
          id: current.id,
          payload: { name },
        });
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
    }
  }

  async function deleteCurrent() {
    if (!canEdit) return;
    if (!current || !breadcrumb || breadcrumb.length <= 1) {
      toast.error('Cannot delete root folder');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete "${current.name}"?`);
    if (!confirmed) return;

    const parentId = breadcrumb[breadcrumb.length - 2]?.id ?? 1;
    trackEvent('folder_delete', { module: 'accounting', id: current.id });

    try {
      await deleteFolderMutation.mutateAsync({ id: current.id, parentId });
      navigate(`/accounting/documents/${parentId}`);
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  }

  function moveCurrent() {
    if (!canEdit) return;
    trackEvent('folder_move_initiated', { module: 'accounting', id: current?.id });
    toast.info('Move action would present a destination picker (prototype).');
  }

  async function shareCurrent() {
    trackEvent('share_link_initiated', { module: 'accounting', id: current?.id });
    toast.info('Share would create a signed link with expiry (prototype).');
  }

  function uploadFiles() {
    if (!canEdit) return;
    trackEvent('upload_click', { module: 'accounting', folderId: currentFolderId });
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    trackEvent('document_upload', { module: 'accounting', folderId: currentFolderId, count: files.length });

    try {
      await uploadFilesMutation.mutateAsync({
        folderId: currentFolderId,
        files: Array.from(files),
      });
    } catch (error) {
      console.error('Failed to upload files:', error);
    }

    e.target.value = '';
  }

  async function handleViewDocument(docId: number, docName: string) {
    trackEvent('document_view', { module: 'accounting', id: docId });

    try {
      const { signedUrl } = await getDocumentUrl(docId, role);
      const newTab = window.open(signedUrl, '_blank');

      if (!newTab) {
        toast.error('Popup blocked. Please allow popups to view files.');
        return;
      }
    } catch (error) {
      toast.error('Failed to get document URL. Please try again.');
      console.error('Failed to view document:', error);
    }
  }

  async function handleDownloadDocument(docId: number, docName: string) {
    trackEvent('document_download', { module: 'accounting', id: docId });

    try {
      const blob = await downloadDocument(docId, role);
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      toast.error('Failed to download document. Please try again.');
      console.error('Failed to download document:', error);
    }
  }

  async function handleDeleteDocument(docId: number, docName: string) {
    if (!canEdit) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${docName}"?`);
    if (!confirmed) return;

    trackEvent('document_delete', { module: 'accounting', id: docId });

    try {
      await deleteDocumentMutation.mutateAsync({ id: docId, folderId: currentFolderId });
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  }

  // Show loading state
  const isLoading = breadcrumbLoading || childrenLoading;

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header + Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary">Documents Explorer</h1>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {breadcrumbLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : (
                breadcrumb.map((node, idx) => (
                  <span key={idx} className="flex items-center">
                    <button className="text-primary hover:underline" onClick={() => navigateToCrumb(node.id)}>{node.name}</button>
                    {idx < breadcrumb.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="border border-border rounded-md px-2 py-1 text-sm bg-background" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
            <Button
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2"
              onClick={uploadFiles}
              disabled={!canEdit || uploadFilesMutation.isPending}
            >
              {uploadFilesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search folders/documents..." className="pl-10" />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          {/* Content */}
          <div className="">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{current?.name}</span>
                  <div className="flex items-center gap-2">
                    <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} className="gap-1">
                      <LayoutGrid className="h-4 w-4" /> Grid
                    </Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="gap-1">
                      <List className="h-4 w-4" /> List
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFolder}
                      disabled={!canEdit || createFolderMutation.isPending}
                      className="gap-1"
                    >
                      {createFolderMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      New Folder
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={renameCurrent}
                      disabled={!canEdit || updateFolderMutation.isPending}
                      className="gap-1"
                    >
                      <Pencil className="h-4 w-4" /> Rename
                    </Button>
                    <Button variant="outline" size="sm" onClick={moveCurrent} disabled={!canEdit} className="gap-1">
                      <Move className="h-4 w-4" /> Move
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteCurrent}
                      disabled={!canEdit || deleteFolderMutation.isPending}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={shareCurrent} className="gap-1">
                      <Share2 className="h-4 w-4" /> Share
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Loading State */}
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading...</span>
                  </div>
                )}

                {/* Error State */}
                {childrenError && (
                  <div className="text-center py-12">
                    <p className="text-destructive">Failed to load folder contents</p>
                    <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && !childrenError && folders.length === 0 && documents.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>This folder is empty</p>
                    {canEdit && <p className="text-sm mt-2">Upload files or create a new folder to get started</p>}
                  </div>
                )}

                {/* Folders */}
                {!isLoading && !childrenError && folders.length > 0 && (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="border border-border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => navigateToNode(folder.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <FolderOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{folder.name}</h4>
                              <p className="text-xs text-muted-foreground capitalize">{folder.type}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="border border-border rounded-lg p-3 hover:bg-accent cursor-pointer transition-colors flex items-center gap-3"
                          onClick={() => navigateToNode(folder.id)}
                        >
                          <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="font-medium flex-1">{folder.name}</span>
                          <Badge variant="outline" className="capitalize">{folder.type}</Badge>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Documents */}
                {!isLoading && !childrenError && documents.length > 0 && (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 ${getFileColor(doc.ext)}`}>
                              {getFileIcon(doc.ext)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{doc.name}</h4>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{formatSize(doc.sizeBytes)}</span>
                                {doc.uploadedBy && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{doc.uploadedBy}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex gap-1 mt-3">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleViewDocument(doc.id, doc.name)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleDownloadDocument(doc.id, doc.name)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                    disabled={deleteDocumentMutation.isPending}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="border border-border rounded-lg p-3 hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 ${getFileColor(doc.ext)}`}>
                              {getFileIcon(doc.ext)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{doc.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatSize(doc.sizeBytes)}</span>
                                {doc.uploadedBy && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{doc.uploadedBy}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDocument(doc.id, doc.name)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadDocument(doc.id, doc.name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                  disabled={deleteDocumentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileSelected}
        />
      </motion.div>
    </MainLayout>
  );
};

export default AccountingDocuments;
