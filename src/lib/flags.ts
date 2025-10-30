const FLAG_ACCOUNTING_DOCS = 'flag_accounting_documents';

export function isAccountingDocumentsEnabled(): boolean {
  const raw = localStorage.getItem(FLAG_ACCOUNTING_DOCS);
  if (raw === null) return true; // default enabled
  return raw === 'true';
}

export function setAccountingDocumentsEnabled(enabled: boolean): void {
  localStorage.setItem(FLAG_ACCOUNTING_DOCS, enabled ? 'true' : 'false');
}

// Optional: toggle helper for quick testing
export function toggleAccountingDocuments(): boolean {
  const next = !isAccountingDocumentsEnabled();
  setAccountingDocumentsEnabled(next);
  return next;
}