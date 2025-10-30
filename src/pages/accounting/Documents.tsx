import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Search, FolderOpen, FileText, Download, Eye, Trash2, Filter, ChevronRight, Plus, Move, Pencil, Share2, LayoutGrid, List } from 'lucide-react';
import {
  getRootFolderId,
  getBreadcrumb,
  listChildren,
  createFolder,
  renameFolder,
  uploadDocuments,
  removeFolder,
  removeDocument,
  getFolder,
  setDocumentsNamespace,
} from '@/lib/store/documents';
import { setDocumentsApiBase } from '@/lib/api/documents';
import { trackEvent } from '@/lib/telemetry';

type Role = 'Admin' | 'Editor' | 'Viewer';

const AccountingDocuments: React.FC = () => {
  const navigate = useNavigate();
  const { folderId: folderIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState<Role>('Editor');
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Use an Accounting-specific namespace for isolated local state
    setDocumentsNamespace('accounting-documents-store');
    // Point API client base to Accounting routes
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

  const currentFolderId = useMemo(() => {
    const id = folderIdParam ? Number(folderIdParam) : getRootFolderId();
    return Number.isFinite(id) ? id : getRootFolderId();
  }, [folderIdParam]);

  useEffect(() => {
    trackEvent('accounting_documents_navigate', { module: 'accounting', folderId: currentFolderId });
  }, [currentFolderId]);

  const breadcrumb = useMemo(() => getBreadcrumb(currentFolderId), [currentFolderId, refreshKey]);
  const current = breadcrumb[breadcrumb.length - 1] ?? getFolder(getRootFolderId());
  const canEdit = role === 'Admin' || role === 'Editor';

  const { folders: children, documents } = useMemo(() => listChildren(currentFolderId), [currentFolderId, refreshKey]);

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

  function addFolder() {
    if (!canEdit) return;
    const name = window.prompt('New folder name:');
    if (!name) return;
    trackEvent('folder_create', { module: 'accounting', parentId: currentFolderId, name });
    createFolder(currentFolderId, name);
    setRefreshKey((x) => x + 1);
  }

  function renameCurrent() {
    if (!canEdit) return;
    const name = window.prompt('Rename to:', current?.name ?? '');
    if (!name) return;
    trackEvent('folder_rename', { module: 'accounting', id: current?.id, name });
    if (current) renameFolder(current.id, name);
    setRefreshKey((x) => x + 1);
  }

  function deleteCurrent() {
    if (!canEdit) return;
    if (!current || current.parentId === null) return alert('Cannot delete root');
    const parentId = breadcrumb[breadcrumb.length - 2]?.id ?? getRootFolderId();
    trackEvent('folder_delete', { module: 'accounting', id: current.id });
    removeFolder(current.id);
    setRefreshKey((x) => x + 1);
    navigate(`/accounting/documents/${parentId}`);
  }

  function moveCurrent() {
    if (!canEdit) return;
    trackEvent('folder_move_initiated', { module: 'accounting', id: current?.id });
    alert('Move action would present a destination picker (prototype).');
  }

  function shareCurrent() {
    trackEvent('share_link_initiated', { module: 'accounting', id: current?.id });
    alert('Share would create a signed link with expiry (prototype).');
  }

  function uploadFiles() {
    if (!canEdit) return;
    trackEvent('upload_click', { module: 'accounting', folderId: currentFolderId });
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    trackEvent('document_upload', { module: 'accounting', folderId: currentFolderId, count: files.length });
    uploadDocuments(currentFolderId, Array.from(files), 'You');
    setRefreshKey((x) => x + 1);
    e.target.value = '';
  }

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
              {breadcrumb.map((node, idx) => (
                <span key={idx} className="flex items-center">
                  <button className="text-primary hover:underline" onClick={() => navigateToCrumb(node.id)}>{node.name}</button>
                  {idx < breadcrumb.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="border border-border rounded-md px-2 py-1 text-sm bg-background" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
            <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2" onClick={uploadFiles} disabled={!canEdit}>
              <Upload className="h-4 w-4" />
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
                    <Button variant="outline" size="sm" onClick={addFolder} disabled={!canEdit} className="gap-1"><Plus className="h-4 w-4" /> New Folder</Button>
                    <Button variant="outline" size="sm" onClick={renameCurrent} disabled={!canEdit} className="gap-1"><Pencil className="h-4 w-4" /> Rename</Button>
                    <Button variant="outline" size="sm" onClick={moveCurrent} disabled={!canEdit} className="gap-1"><Move className="h-4 w-4" /> Move</Button>
                    <Button variant="outline" size="sm" onClick={deleteCurrent} disabled={!canEdit} className="gap-1"><Trash2 className="h-4 w-4" /> Delete</Button>
                    <Button variant="outline" size="sm" onClick={shareCurrent} className="gap-1"><Share2 className="h-4 w-4" /> Share</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Folders */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                    {children.map((child, idx) => (
                      <motion.div key={child.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                        className="p-3 border border-border rounded-lg bg-card hover:shadow-sm cursor-pointer" onClick={() => navigateToNode(child.id)}>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          <div className="font-medium text-sm truncate">{child.name}</div>
                          <Badge variant="outline" className="ml-auto text-xs">{child.type}</Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          <div className="font-medium text-sm">{child.name}</div>
                          <Badge variant="outline" className="ml-2 text-xs">{child.type}</Badge>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => navigateToNode(child.id)}>Open</Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents list */}
                <div className="space-y-3">
                  {documents.map((doc, index) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card text-card-foreground"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={getFileColor(doc.ext)}>
                          {getFileIcon(doc.ext || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>v{doc.version}</span>
                            <span>•</span>
                            <span>{formatSize(doc.sizeBytes)}</span>
                            <span>•</span>
                            <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1"><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="outline" size="sm" className="gap-1"><Download className="h-4 w-4" /> Download</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => { if (!canEdit) return; trackEvent('document_delete', { module: 'accounting', id: doc.id }); removeDocument(doc.id); setRefreshKey((x) => x + 1); }}
                          disabled={!canEdit}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Upload input (hidden) */}
                <input type="file" ref={fileInputRef} hidden multiple onChange={onFileSelected} />
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default AccountingDocuments;