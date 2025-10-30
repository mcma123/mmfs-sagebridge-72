import { describe, it, expect, beforeEach } from 'vitest';
import {
  setDocumentsNamespace,
  getDocumentsNamespace,
  getRootFolderId,
  createFolder,
  listChildren,
  uploadDocuments,
  removeDocument,
  getAuditLogs,
} from './documents';

function clearNamespace() {
  const ns = getDocumentsNamespace();
  localStorage.removeItem(ns);
}

describe('Documents store', () => {
  beforeEach(() => {
    setDocumentsNamespace('test-documents-store');
    clearNamespace();
    // Trigger seed on first load
    getRootFolderId();
  });

  it('seeds store with root and default children', () => {
    const rootId = getRootFolderId();
    const { folders } = listChildren(rootId);
    expect(rootId).toBeGreaterThan(0);
    expect(folders.length).toBeGreaterThan(0);
  });

  it('creates a folder under root', () => {
    const rootId = getRootFolderId();
    const folder = createFolder(rootId, 'Test Folder');
    const { folders } = listChildren(rootId);
    expect(folders.map(f => f.id)).toContain(folder.id);
  });

  it('uploads and removes a document', () => {
    const rootId = getRootFolderId();
    const folder = createFolder(rootId, 'Uploads');
    const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' });
    const created = uploadDocuments(folder.id, [file], 'Tester');
    expect(created.length).toBe(1);
    const { documents } = listChildren(folder.id);
    expect(documents.length).toBe(1);
    removeDocument(created[0].id);
    const after = listChildren(folder.id).documents;
    expect(after.length).toBe(0);
  });

  it('writes audit logs for actions', () => {
    const rootId = getRootFolderId();
    const folder = createFolder(rootId, 'Audit');
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    const [doc] = uploadDocuments(folder.id, [file], 'Tester');
    removeDocument(doc.id);
    const logs = getAuditLogs(folder.id);
    expect(logs.length).toBeGreaterThan(0);
  });
});