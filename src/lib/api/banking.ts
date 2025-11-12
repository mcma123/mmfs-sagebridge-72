// Banking API client for frontend use
// Provides interface to banking import endpoints

import type { Role } from './accounting';
import type {
  ImportSession,
  ImportMappingTemplate,
  NormalizedTransaction,
  ImportError,
  ImportAuditEvent,
  DestinationSelection,
  CommitResult,
  ImportSessionTotals,
} from '../banking/models';

let API_BASE = '/api/v1/banking/import';

export function setBankingApiBase(base: string) {
  API_BASE = base || '/api/v1/banking/import';
}

async function apiFetch<T>(path: string, init: RequestInit = {}, role: Role = 'accountant'): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Role': role,
  };

  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    /* non-json response */
  }

  if (!resp.ok) {
    const message = (data && (data.message || data.error)) || resp.statusText || 'Request failed';
    throw new Error(`${resp.status} ${message}`);
  }

  return data as T;
}

// ========================================
// Session Management
// ========================================

export interface CreateSessionRequest {
  fileName: string;
  fileHash: string;
  mappingTemplateId?: number | null;
}

export interface SessionListResponse {
  items: ImportSession[];
}

export interface SessionDetailResponse extends ImportSession {
  transactions?: NormalizedTransaction[];
  errors?: ImportError[];
  auditEvents?: ImportAuditEvent[];
}

/**
 * List all import sessions for the current user
 */
export async function listSessions(role: Role = 'accountant'): Promise<SessionListResponse> {
  return apiFetch<SessionListResponse>('/sessions', { method: 'GET' }, role);
}

/**
 * Create a new import session
 */
export async function createSession(
  payload: CreateSessionRequest,
  role: Role = 'accountant'
): Promise<ImportSession> {
  return apiFetch<ImportSession>('/sessions', { method: 'POST', body: JSON.stringify(payload) }, role);
}

/**
 * Get session details including transactions and errors
 */
export async function getSession(sessionId: string, role: Role = 'accountant'): Promise<SessionDetailResponse> {
  return apiFetch<SessionDetailResponse>(`/sessions/${sessionId}`, { method: 'GET' }, role);
}

// ========================================
// Analysis & Staging
// ========================================

export interface AnalyzeRequest {
  rows: Array<{
    rowIndex: number;
    date: string | null;
    description: string | null;
    amount: number | null;
    debit?: number | null;
    credit?: number | null;
    accountCode?: string | null;
    reference?: string | null;
    currency?: string | null;
  }>;
}

export interface AnalyzeResponse {
  totals: ImportSessionTotals;
  errors: ImportError[];
  duplicates: number[];
}

/**
 * Analyze rows and compute totals, validation errors, and duplicates
 */
export async function analyzeSession(
  sessionId: string,
  payload: AnalyzeRequest,
  role: Role = 'accountant'
): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>(
    `/sessions/${sessionId}/analyze`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
}

export interface StageRequest {
  transactions: Array<Omit<NormalizedTransaction, 'id' | 'sessionId'>>;
}

export interface StageResponse {
  stagedCount: number;
  duplicateCount: number;
}

/**
 * Stage normalized transactions for the session
 */
export async function stageTransactions(
  sessionId: string,
  payload: StageRequest,
  role: Role = 'accountant'
): Promise<StageResponse> {
  return apiFetch<StageResponse>(
    `/sessions/${sessionId}/stage`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
}

// ========================================
// Row Editing
// ========================================

export interface UpdateRowRequest {
  updates: Partial<Pick<NormalizedTransaction, 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'accountCode' | 'reference' | 'currency'>>;
}

/**
 * Update a staged transaction row
 */
export async function updateRow(
  sessionId: string,
  rowId: string,
  payload: UpdateRowRequest,
  role: Role = 'accountant'
): Promise<NormalizedTransaction> {
  return apiFetch<NormalizedTransaction>(
    `/sessions/${sessionId}/rows/${rowId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    role
  );
}

// ========================================
// Commit
// ========================================

export interface CommitRequest {
  bankAccountCode: string;
  destinations: DestinationSelection;
  aggregation?: 'none' | 'by_date' | 'by_account';
}

/**
 * Commit staged transactions to selected destinations
 */
export async function commitSession(
  sessionId: string,
  payload: CommitRequest,
  role: Role = 'accountant'
): Promise<CommitResult> {
  return apiFetch<CommitResult>(
    `/sessions/${sessionId}/commit`,
    { method: 'POST', body: JSON.stringify(payload) },
    role
  );
}

// ========================================
// Templates
// ========================================

export interface TemplateListResponse {
  items: ImportMappingTemplate[];
}

export interface CreateTemplateRequest {
  name: string;
  bank: string;
  headerMap: Record<string, string>;
  transforms?: {
    invertSigns?: boolean;
    fixedCurrency?: string | null;
    defaultAccountCode?: string | null;
  };
}

/**
 * List all mapping templates
 */
export async function listTemplates(role: Role = 'accountant'): Promise<TemplateListResponse> {
  return apiFetch<TemplateListResponse>('/templates', { method: 'GET' }, role);
}

/**
 * Create a new mapping template
 */
export async function createTemplate(
  payload: CreateTemplateRequest,
  role: Role = 'accountant'
): Promise<ImportMappingTemplate> {
  return apiFetch<ImportMappingTemplate>('/templates', { method: 'POST', body: JSON.stringify(payload) }, role);
}

// ========================================
// Audit
// ========================================

export interface AuditEventsResponse {
  items: ImportAuditEvent[];
}

/**
 * Get audit events for a session
 */
export async function getAuditEvents(sessionId: string, role: Role = 'accountant'): Promise<AuditEventsResponse> {
  return apiFetch<AuditEventsResponse>(`/sessions/${sessionId}/audit`, { method: 'GET' }, role);
}
