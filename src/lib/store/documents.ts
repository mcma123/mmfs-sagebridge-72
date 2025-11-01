// Lightweight in-browser store for DMS Documents module
// Persists folders, documents, templates, and audit logs in localStorage.

export type Role = 'Admin' | 'Editor' | 'Viewer';
export type NodeType = 'company' | 'country' | 'cedant' | 'category' | 'treaty_section' | 'generic';

export interface Folder {
  id: number;
  parentId: number | null;
  name: string;
  type: NodeType;
  path: number[]; // materialized IDs path from root to this folder
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface DocumentItem {
  id: number;
  folderId: number;
  name: string;
  ext?: string;
  mimeType?: string;
  sizeBytes?: number;
  tags?: string[];
  uploadedBy?: string;
  version: number;
  createdAt: string;
}

export interface UploadFolderResult {
  createdFolderIds: number[];
  createdDocIds: number[];
  skippedDocuments: string[];
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'folder' | 'document';
  entityId: number;
  actor?: string;
  metadata?: Record<string, any>;
  at: string;
}

interface StoreShape {
  seq: number;
  rootFolderId: number;
  folders: Record<number, Folder>;
  documents: Record<number, DocumentItem>;
  audit: AuditLog[];
}

// Namespace & data source scaffolding
let LS_KEY = 'dms-documents-store';
type DataSource = 'local' | 'api';
let DATA_SOURCE: DataSource = 'local';

export function setDocumentsNamespace(ns: string) { LS_KEY = ns; }
export function getDocumentsNamespace(): string { return LS_KEY; }
export function setDataSource(source: DataSource) { DATA_SOURCE = source; }
export function getDataSource(): DataSource { return DATA_SOURCE; }

function nowISO() { return new Date().toISOString(); }

function nextId(store: StoreShape) { store.seq += 1; return store.seq; }

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function loadStore(): StoreShape {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw) as StoreShape;
      // Migration: rename any company named "Acme Re" to "MMFS"
      let changed = false;
      Object.values(s.folders).forEach((f) => {
        if (f.parentId === null && f.type === 'company' && f.name === 'Acme Re') {
          f.name = 'MMFS';
          changed = true;
        }
      });
      if (changed) persist(s);
      return s;
    } catch {}
  }
  const store: StoreShape = {
    seq: 0,
    rootFolderId: 0,
    folders: {},
    documents: {},
    audit: [],
  };
  // Seed: one company → Countries → default list
  const rootId = nextId(store);
  const company: Folder = { id: rootId, parentId: null, name: 'MMFS', type: 'company', path: [rootId], createdAt: nowISO() };
  store.folders[rootId] = company;
  store.rootFolderId = rootId;

  const countriesId = nextId(store);
  store.folders[countriesId] = { id: countriesId, parentId: rootId, name: 'Countries', type: 'generic', path: [rootId, countriesId], createdAt: nowISO() };

  const defaults = ['Zimbabwe', 'Botswana', 'Mozambique', 'Malawi', 'Angola', 'Zambia', 'South Africa'];
  defaults.forEach((name) => {
    const id = nextId(store);
    store.folders[id] = { id, parentId: countriesId, name, type: 'country', path: [rootId, countriesId, id], createdAt: nowISO() };
  });

  persist(store);
  return store;
}

export function persist(store: StoreShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

export function getRootFolderId(): number {
  const s = loadStore();
  return s.rootFolderId;
}

export function getFolder(id: number): Folder | undefined {
  const s = loadStore();
  return s.folders[id];
}

export function getBreadcrumb(id: number): Folder[] {
  const s = loadStore();
  const f = s.folders[id];
  if (!f) return [];
  return f.path.map((fid) => s.folders[fid]).filter(Boolean) as Folder[];
}

export function listChildren(folderId: number): { folders: Folder[]; documents: DocumentItem[] } {
  const s = loadStore();
  const folders = Object.values(s.folders).filter((f) => f.parentId === folderId);
  const documents = Object.values(s.documents).filter((d) => d.folderId === folderId);
  return { folders, documents };
}

export function createFolder(parentId: number, name: string, type: NodeType = 'generic'): Folder {
  const s = loadStore();
  const parent = s.folders[parentId];
  if (!parent) throw new Error('Parent folder not found');
  const id = nextId(s);
  const folder: Folder = { id, parentId, name, type, path: [...parent.path, id], createdAt: nowISO() };
  s.folders[id] = folder;
  logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: 'folder.create', entityType: 'folder', entityId: id, metadata: { name, type, parentId }, at: nowISO() });
  persist(s);
  return folder;
}


export function ensureChildFolder(parentId: number, name: string, type: NodeType = 'generic'): { folder: Folder; created: boolean } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name cannot be empty');
  const s = loadStore();
  const parent = s.folders[parentId];
  if (!parent) throw new Error('Parent folder not found');
  const normalized = normalizeName(trimmed);
  const existing = Object.values(s.folders).find((f) => f.parentId === parentId && normalizeName(f.name) === normalized);
  if (existing) {
    return { folder: existing, created: false };
  }
  const folder = createFolder(parentId, trimmed, type);
  return { folder, created: true };
}

export function ensurePath(parentId: number, segments: string[], type: NodeType = 'generic'): { folder: Folder; createdFolderIds: number[] } {
  const baseFolder = getFolder(parentId);
  if (!baseFolder) throw new Error('Parent folder not found');

  let currentFolder = baseFolder;
  const created: number[] = [];

  segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const { folder, created: wasCreated } = ensureChildFolder(currentFolder.id, segment, type);
      currentFolder = folder;
      if (wasCreated) {
        created.push(folder.id);
      }
    });

  return { folder: currentFolder, createdFolderIds: created };
}

export function uploadFolderStructure(parentId: number, files: File[], uploadedBy?: string): UploadFolderResult {
  const createdFolderIds = new Set<number>();
  const createdDocIds: number[] = [];
  const skippedDocuments: string[] = [];
  const grouped = new Map<number, File[]>();
  const pathCache = new Map<string, number>();

  const ensureWithCache = (baseId: number, segments: string[]): number => {
    if (segments.length === 0) return baseId;
    const key = `${baseId}::${segments.map((s) => normalizeName(s)).join('/')}`;
    if (pathCache.has(key)) {
      return pathCache.get(key)!;
    }
    const { folder, createdFolderIds: newlyCreated } = ensurePath(baseId, segments);
    newlyCreated.forEach((id) => createdFolderIds.add(id));
    pathCache.set(key, folder.id);
    return folder.id;
  };

  files.forEach((file) => {
    const relPath = (file as any).webkitRelativePath as string | undefined;
    const relative = relPath || file.name;
    const parts = relative.split(/[\\/]/).filter(Boolean);
    const folderSegments = parts.slice(0, Math.max(parts.length - 1, 0));
    const targetFolderId = ensureWithCache(parentId, folderSegments);
    const bucket = grouped.get(targetFolderId);
    if (bucket) {
      bucket.push(file);
    } else {
      grouped.set(targetFolderId, [file]);
    }
  });

  grouped.forEach((fileList, folderId) => {
    const snapshot = loadStore();
    const existingNames = new Set(
      Object.values(snapshot.documents)
        .filter((d) => d.folderId === folderId)
        .map((d) => normalizeName(d.name)),
    );

    const toUpload = fileList.filter((file) => {
      const name = normalizeName(file.name);
      if (existingNames.has(name)) {
        const relPath = (file as any).webkitRelativePath as string | undefined;
        skippedDocuments.push(relPath || file.name);
        return false;
      }
      existingNames.add(name);
      return true;
    });

    if (toUpload.length === 0) return;
    const created = uploadDocuments(folderId, toUpload, uploadedBy);
    created.forEach((doc) => {
      createdDocIds.push(doc.id);
    });
  });

  return {
    createdFolderIds: Array.from(createdFolderIds),
    createdDocIds,
    skippedDocuments,
  };
}

export function renameFolder(id: number, name: string) {
  const s = loadStore();
  const folder = s.folders[id];
  if (!folder) throw new Error('Folder not found');
  folder.name = name;
  logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: 'folder.rename', entityType: 'folder', entityId: id, metadata: { name }, at: nowISO() });
  persist(s);
  return folder;
}

export function uploadDocuments(folderId: number, files: File[], uploadedBy?: string): DocumentItem[] {
  const s = loadStore();
  const created: DocumentItem[] = [];
  files.forEach((file) => {
    const id = nextId(s);
    const name = file.name;
    const ext = name.includes('.') ? name.split('.').pop() : undefined;
    const item: DocumentItem = {
      id,
      folderId,
      name,
      ext,
      mimeType: file.type,
      sizeBytes: file.size,
      version: 1,
      uploadedBy,
      createdAt: nowISO(),
    };
    s.documents[id] = item;
    logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: 'document.upload', entityType: 'document', entityId: id, metadata: { folderId, name, size: file.size }, at: nowISO() });
    created.push(item);
  });
  persist(s);
  return created;
}

export function applyTemplate(folderId: number, template: 'treaty_sections' | 'cedants' | 'country_seed' | 'company_root') {
  const s = loadStore();
  const parent = s.folders[folderId];
  if (!parent) throw new Error('Folder not found');
  const created: Folder[] = [];
  const add = (name: string, type: NodeType) => { created.push(createFolder(folderId, name, type)); };
  switch (template) {
    case 'treaty_sections':
      add('Quotations', 'treaty_section');
      add('Placements', 'treaty_section');
      add('Masters', 'treaty_section');
      break;
    case 'cedants':
      add('Cedants', 'generic');
      break;
    case 'country_seed':
      ['Zimbabwe', 'Botswana', 'Mozambique', 'Malawi', 'Angola', 'Zambia', 'South Africa'].forEach((c) => add(c, 'country'));
      break;
    case 'company_root':
      add('Countries', 'generic');
      break;
    default:
      break;
  }
  const actionName = `template.apply.${template}`;
  logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: actionName, entityType: 'folder', entityId: folderId, metadata: { created: created.map(f => f.id) }, at: nowISO() });
  persist(s);
  return created;
}

export function search(query: string, folderScopeId?: number): { folders: Folder[]; documents: DocumentItem[] } {
  const s = loadStore();
  const q = query.trim().toLowerCase();
  const folders = Object.values(s.folders).filter((f) => {
    const withinScope = !folderScopeId || f.path.includes(folderScopeId);
    return withinScope && f.name.toLowerCase().includes(q);
  });
  const documents = Object.values(s.documents).filter((d) => {
    const withinScope = !folderScopeId || s.folders[d.folderId]?.path.includes(folderScopeId);
    return withinScope && d.name.toLowerCase().includes(q);
  });
  return { folders, documents };
}

export function getAuditLogs(folderId?: number): AuditLog[] {
  const s = loadStore();
  if (!folderId) return s.audit.slice().reverse();
  const related = s.audit.filter((a) => {
    if (a.entityType === 'folder') return a.entityId === folderId;
    if (a.entityType === 'document') {
      const doc = s.documents[a.entityId];
      return doc?.folderId === folderId;
    }
    return false;
  });
  return related.slice().reverse();
}

function logInternal(store: StoreShape, entry: AuditLog) {
  store.audit.push(entry);
}

export function removeDocument(id: number) {
  const s = loadStore();
  if (!s.documents[id]) return;
  const folderId = s.documents[id].folderId;
  delete s.documents[id];
  logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: 'document.delete', entityType: 'document', entityId: id, metadata: { folderId }, at: nowISO() });
  persist(s);
}

export function removeFolder(id: number) {
  const s = loadStore();
  if (!s.folders[id]) return;
  // Recursively remove children
  const children = Object.values(s.folders).filter((f) => f.parentId === id);
  children.forEach((c) => removeFolder(c.id));
  const docs = Object.values(s.documents).filter((d) => d.folderId === id);
  docs.forEach((d) => removeDocument(d.id));
  const parentId = s.folders[id].parentId;
  delete s.folders[id];
  logInternal(s, { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`, action: 'folder.delete', entityType: 'folder', entityId: id, metadata: { parentId }, at: nowISO() });
  persist(s);
}