import { analyzeCsv, streamRows } from './csv';
import {
  ImportSession,
  ImportMappingTemplate,
  NormalizedTransaction,
  ImportError,
  ImportAuditEvent,
  ImportSessionTotals,
  DestinationSelection,
  CommitResult,
  SystemField,
} from './models';
import {
  sanitizeText,
  parseDate,
  parseAmount,
  deriveSignedAmount,
  isIsoCurrency,
  validateAccountCode,
  stableRowHash,
} from './validators';

type StoreShape = {
  seq: number;
  sessions: Record<string, ImportSession>;
  templates: Record<string, ImportMappingTemplate>;
  transactions: Record<string, NormalizedTransaction[]>;
  errors: Record<string, ImportError[]>;
  audit: Record<string, ImportAuditEvent[]>;
};

const LS_KEY = 'banking-import-store-v1';
let store: StoreShape | null = null;

function initStore(): StoreShape {
  if (store) return store;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) store = JSON.parse(raw);
  } catch { /* ignore */ }
  if (!store) {
    store = { seq: 1, sessions: {}, templates: {}, transactions: {}, errors: {}, audit: {} };
  }
  return store!;
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

function nextId(prefix: string) { const s = initStore(); const id = `${prefix}-${s.seq++}`; persist(); return id; }

export async function computeFileHash(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return `${file.name}-${file.size}`;
  }
}

export function listSessions(): ImportSession[] {
  const s = initStore();
  return Object.values(s.sessions).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSession(file: File, userId: string): Promise<ImportSession> {
  const s = initStore();
  const id = nextId('sess');
  const fileHash = await computeFileHash(file);
  const session: ImportSession = {
    id,
    userId,
    createdAt: new Date().toISOString(),
    fileName: file.name,
    fileHash,
    status: 'new',
    totals: { count: 0, valid: 0, invalid: 0, duplicate: 0, excluded: 0, debitTotal: 0, creditTotal: 0 },
  };
  s.sessions[id] = session;
  s.transactions[id] = [];
  s.errors[id] = [];
  s.audit[id] = [];
  persist();
  return session;
}

export async function analyzeFile(file: File) {
  return analyzeCsv(file, 25);
}

export function suggestField(header: string): SystemField | undefined {
  const h = header.toLowerCase();
  if (h.includes('date')) return 'date';
  if (h.includes('desc') || h.includes('narrat')) return 'description';
  if (h.includes('amount') || h === 'amt' || h === 'value') return 'amount';
  if (h.includes('debit') || h === 'dr') return 'debit';
  if (h.includes('credit') || h === 'cr') return 'credit';
  if (h.includes('account') || h.includes('acct') || h.includes('gl')) return 'accountCode';
  if (h.includes('ref') || h.includes('reference')) return 'reference';
  if (h.includes('currency') || h === 'curr' || h === 'fx') return 'currency';
  return undefined;
}

export function saveTemplate(template: Omit<ImportMappingTemplate, 'id'>): ImportMappingTemplate {
  const s = initStore();
  const id = nextId('tmpl');
  const t: ImportMappingTemplate = { id, ...template };
  s.templates[id] = t;
  persist();
  return t;
}

function updateTotals(sessionId: string) {
  const s = initStore();
  const rows = s.transactions[sessionId] || [];
  let valid = 0, invalid = 0, duplicate = 0, excluded = 0, debitTotal = 0, creditTotal = 0;
  for (const r of rows) {
    if (r.excluded) { excluded++; continue; }
    if (r.validationStatus === 'valid') valid++; else invalid++;
    if (r.duplicateFlag) duplicate++;
    const amt = r.amount ?? deriveSignedAmount(r.debit ?? null, r.credit ?? null, null) ?? 0;
    if (amt >= 0) debitTotal += amt; else creditTotal += Math.abs(amt);
  }
  const sess = s.sessions[sessionId];

  if (!sess) {
    console.error(`[store] Session ${sessionId} not found in localStorage during updateTotals`);
    return;
  }

  sess.totals = { count: rows.length, valid, invalid, duplicate, excluded, debitTotal, creditTotal } as ImportSessionTotals;
  persist();
}

function validateRow(ntx: NormalizedTransaction, s: StoreShape): { errors: ImportError[]; status: NormalizedTransaction['validationStatus'] } {
  const errs: ImportError[] = [];
  const mustHaveAmount = (ntx.amount !== null) || (ntx.debit !== null || ntx.credit !== null);
  if (!ntx.date) errs.push(makeError(ntx, 'date', 'INVALID_DATE', 'Date is missing or invalid'));
  if (!sanitizeText(ntx.description)) errs.push(makeError(ntx, 'description', 'INVALID_DESCRIPTION', 'Description is required'));
  if (!mustHaveAmount) errs.push(makeError(ntx, 'amount', 'INVALID_AMOUNT', 'Amount or Debit/Credit required'));
  if (ntx.currency && !isIsoCurrency(ntx.currency)) errs.push(makeError(ntx, 'currency', 'INVALID_CURRENCY', 'Currency must be ISO 4217'));
  if (ntx.accountCode && !validateAccountCode(ntx.accountCode)) errs.push(makeError(ntx, 'accountCode', 'INVALID_ACCOUNT', 'Account code format invalid'));
  const status: NormalizedTransaction['validationStatus'] = errs.length ? 'invalid' : 'valid';
  return { errors: errs, status };
}

function makeError(ntx: NormalizedTransaction, field: SystemField, code: string, message: string): ImportError {
  const s = initStore();
  return { id: nextId('err'), sessionId: ntx.sessionId, rowIndex: ntx.rowIndex, field, code, message };
}

export async function stageFile(sessionId: string, file: File, template: ImportMappingTemplate): Promise<{ rows: number }>{
  const s = initStore();
  const existing = s.transactions[sessionId] || [];
  const seen = new Set(existing.map(r => r.rowHash));
  const rows: NormalizedTransaction[] = [];
  const errors: ImportError[] = [];
  await streamRows(file, (row, index) => {
    const nts: NormalizedTransaction = {
      id: nextId('row'),
      sessionId,
      rowIndex: index,
      date: parseDate(asField(row, template, 'date')),
      description: sanitizeText(asField(row, template, 'description')),
      amount: parseAmount(asField(row, template, 'amount')),
      debit: parseAmount(asField(row, template, 'debit')),
      credit: parseAmount(asField(row, template, 'credit')),
      accountCode: sanitizeText(asField(row, template, 'accountCode')),
      reference: sanitizeText(asField(row, template, 'reference')),
      currency: sanitizeText(asField(row, template, 'currency')),
      validationStatus: 'unmapped',
      duplicateFlag: false,
      excluded: false,
      editHistory: [],
      rowHash: '',
    };

    // transforms
    if (template.transforms?.invertSigns) {
      if (nts.amount !== null) nts.amount = -nts.amount;
      if (nts.debit !== null || nts.credit !== null) {
        const d = nts.debit || 0; const c = nts.credit || 0;
        nts.debit = c; nts.credit = d;
      }
    }
    if (!nts.currency && template.transforms?.fixedCurrency) nts.currency = template.transforms.fixedCurrency;
    if (!nts.accountCode && template.transforms?.defaultAccountCode) nts.accountCode = template.transforms.defaultAccountCode;

    const signed = deriveSignedAmount(nts.debit ?? null, nts.credit ?? null, nts.amount ?? null);
    const hash = stableRowHash([nts.date, nts.description, signed, nts.accountCode, nts.reference]);
    nts.rowHash = hash;
    nts.duplicateFlag = seen.has(hash);
    seen.add(hash);

    const { errors: rowErrors, status } = validateRow(nts, s);
    nts.validationStatus = status;
    errors.push(...rowErrors);
    rows.push(nts);
  });
  s.transactions[sessionId] = rows;
  s.errors[sessionId] = errors;
  const sess = s.sessions[sessionId];

  if (!sess) {
    console.error(`[store] Session ${sessionId} not found in localStorage during stageFile`);
    return { rows: rows.length };
  }

  sess.status = 'staged';
  updateTotals(sessionId);
  s.audit[sessionId].push({ id: nextId('audit'), sessionId, actorId: s.sessions[sessionId].userId, timestamp: new Date().toISOString(), action: 'stage', details: { rows: rows.length } });
  persist();
  return { rows: rows.length };
}

function asField(row: Record<string, any>, template: ImportMappingTemplate, field: SystemField): string | null {
  const header = Object.keys(template.headerMap).find(h => template.headerMap[h] === field);
  if (!header) return null;
  const val = row[header];
  return val === undefined || val === null ? null : String(val);
}

export function editRow(sessionId: string, rowId: string, field: SystemField, newValue: any) {
  const s = initStore();
  const rows = s.transactions[sessionId] || [];
  const row = rows.find(r => r.id === rowId);
  if (!row) return;
  const oldValue = (row as any)[field];
  (row as any)[field] = newValue;
  row.editHistory.push({ field, oldValue, newValue, timestamp: new Date().toISOString() });
  // Re-validate and recompute hash
  const signed = deriveSignedAmount(row.debit ?? null, row.credit ?? null, row.amount ?? null);
  row.rowHash = stableRowHash([row.date, row.description, signed, row.accountCode, row.reference]);
  const { errors: rowErrors, status } = validateRow(row, s);
  row.validationStatus = status;
  // replace errors for this row
  s.errors[sessionId] = (s.errors[sessionId] || []).filter(e => e.rowIndex !== row.rowIndex).concat(rowErrors);
  updateTotals(sessionId);
  persist();
}

export function excludeRows(sessionId: string, ids: string[], excluded = true) {
  const s = initStore();
  const rows = s.transactions[sessionId] || [];
  for (const r of rows) if (ids.includes(r.id)) r.excluded = excluded;
  updateTotals(sessionId);
  persist();
}

export function getSession(sessionId: string): { session: ImportSession; rows: NormalizedTransaction[]; errors: ImportError[] } {
  const s = initStore();
  return { session: s.sessions[sessionId], rows: s.transactions[sessionId] || [], errors: s.errors[sessionId] || [] };
}

export function setSessionTemplate(sessionId: string, templateId: string) {
  const s = initStore();
  const sess = s.sessions[sessionId];

  if (!sess) {
    console.error(`[store] Session ${sessionId} not found in localStorage`);
    return;
  }

  sess.mappingTemplateId = templateId;
  sess.status = 'mapped';
  persist();
}

export async function commitSession(sessionId: string, destinations: DestinationSelection): Promise<CommitResult> {
  const s = initStore();
  const rows = s.transactions[sessionId] || [];
  const commitables = rows.filter(r => !r.excluded && r.validationStatus === 'valid');
  const result: CommitResult = {
    sessionId,
    success: true,
    committedRows: commitables.length,
    errors: [],
    reportUrl: `/local/import-report/${sessionId}.json`,
  };
  s.sessions[sessionId].status = 'committed';
  s.audit[sessionId].push({ id: nextId('audit'), sessionId, actorId: s.sessions[sessionId].userId, timestamp: new Date().toISOString(), action: 'commit', details: { destinations, committed: commitables.length } });
  persist();
  return result;
}