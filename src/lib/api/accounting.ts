// Lightweight Accounting API client for frontend use
// Follows the pattern used in src/lib/api/documents.ts

import { getAccessToken } from '@/lib/api/auth';

export type Role = 'admin' | 'accountant' | 'editor' | 'viewer';

let API_BASE = '/api/v1/accounting';

export function setAccountingApiBase(base: string) {
  API_BASE = base || '/api/v1/accounting';
}

async function apiFetch<T>(path: string, init: RequestInit = {}, role: Role = 'accountant', userId?: number): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Role': role,
  };
  if (userId) headers['x-user-id'] = String(userId);

  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await resp.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { /* non-json response */ }
  if (!resp.ok) {
    const message = (data && (data.message || data.error)) || resp.statusText || 'Request failed';
    throw new Error(`${resp.status} ${message}`);
  }
  return data as T;
}

// Types aligning to backend models
export type EntityDTO = {
  id: number;
  type: 'Client' | 'CDANT' | 'Reinsurer' | string;
  name: string;
  status?: string | null;
  currency?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  deleted_at?: string | null;
};

export type AccountDTO = {
  id: number;
  code: string;
  name: string;
  type: string;
  currency?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
};

export type JournalDTO = {
  id: number;
  date: string; // ISO date
  reference?: string | null;
  description?: string | null;
  created_by?: number | null;
  created_at?: string;
  voided_at?: string | null;
  status?: 'draft' | 'reviewed' | 'posted';
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  posted_at?: string | null;
  posted_by?: number | null;
  total_amount?: number;
};

export type JournalLineInput = {
  account_id: number;
  entity_id?: number | null;
  date: string; // ISO date
  debit: number; // positive number or 0
  credit: number; // positive number or 0
  memo?: string | null;
};

export type PostJournalRequest = {
  date: string;
  reference?: string | null;
  description?: string | null;
  lines: JournalLineInput[];
};

export type CreateAccountRequest = {
  code: string;
  name: string;
  type: string;
  currency?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
};

export type JournalLineDTO = {
  id: number;
  journal_id: number;
  account_id: number;
  entity_id?: number | null;
  date: string;
  debit: number;
  credit: number;
  memo?: string | null;
  created_at?: string;
};

export async function getEntities(role: Role = 'accountant') {
  return apiFetch<{ items: EntityDTO[] }>(`/entities`, { method: 'GET' }, role);
}

export async function getAccounts(role: Role = 'accountant') {
  return apiFetch<{ items: AccountDTO[] }>(`/accounts`, { method: 'GET' }, role);
}

export async function getAccount(id: number, role: Role = 'accountant') {
  return apiFetch<AccountDTO>(`/accounts/${id}`, { method: 'GET' }, role);
}

export async function createAccount(payload: CreateAccountRequest, role: Role = 'accountant') {
  return apiFetch<AccountDTO>(`/accounts`, { method: 'POST', body: JSON.stringify(payload) }, role);
}

export async function getJournals(params?: { start?: string; end?: string; status?: 'draft' | 'reviewed' | 'posted' }, role: Role = 'accountant') {
  const qs = new URLSearchParams();
  if (params?.start) qs.set('start', params.start);
  if (params?.end) qs.set('end', params.end);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  const path = `/journals${q ? `?${q}` : ''}`;
  return apiFetch<{ items: JournalDTO[] }>(path, { method: 'GET' }, role);
}

export async function postJournal(payload: PostJournalRequest, role: Role = 'accountant', userId: number = 1) {
  return apiFetch<{ journal_id: number }>(`/journals`, { method: 'POST', body: JSON.stringify(payload) }, role, userId);
}

export async function getEntity(id: number, role: Role = 'accountant') {
  return apiFetch<EntityDTO>(`/entities/${id}`, { method: 'GET' }, role);
}

export async function deleteEntity(id: number, role: Role = 'accountant') {
  return apiFetch<void>(`/entities/${id}`, { method: 'DELETE' }, role);
}

export async function getJournal(id: number, role: Role = 'accountant') {
  return apiFetch<{ journal: JournalDTO; lines: JournalLineDTO[] }>(`/journals/${id}`, { method: 'GET' }, role);
}

export async function voidJournal(id: number, reason?: string, role: Role = 'accountant', userId: number = 1) {
  return apiFetch<{ reversal_journal_id: number }>(`/journals/${id}/void`, { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) }, role, userId);
}

export type TrialBalanceDTO = {
  account_id: number;
  code: string;
  name: string;
  type: string;
  balance: number;
};

export async function getTrialBalance(
  params?: { asOfDate?: string },
  role: Role = 'accountant'
) {
  const queryParams = new URLSearchParams();
  if (params?.asOfDate) {
    queryParams.append('asOfDate', params.asOfDate);
  }
  const queryString = queryParams.toString();
  const url = queryString ? `/trial-balance?${queryString}` : '/trial-balance';
  return apiFetch<{ items: TrialBalanceDTO[] }>(url, { method: 'GET' }, role);
}

export async function exportTrialBalance(
  params?: { asOfDate?: string },
  role: Role = 'accountant'
): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (params?.asOfDate) {
    queryParams.append('asOfDate', params.asOfDate);
  }
  const queryString = queryParams.toString();
  const url = queryString ? `/trial-balance/export?${queryString}` : '/trial-balance/export';

  // Safely retrieve access token with defensive error handling
  const token = (() => {
    try {
      return getAccessToken();
    } catch (error) {
      console.warn('Failed to retrieve access token:', error);
      return null;
    }
  })();

  const headers: Record<string, string> = {
    'X-Role': role,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v1/accounting${url}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || errorData?.message || 'Failed to export trial balance');
  }

  return response.blob();
}

export type UpdateAccountRequest = {
  code?: string;
  name?: string;
  type?: string;
  currency?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
};

export async function updateAccount(id: number, payload: UpdateAccountRequest, role: Role = 'accountant') {
  return apiFetch<AccountDTO>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, role);
}

export async function deleteAccount(id: number, role: Role = 'accountant') {
  return apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }, role);
}

export async function createJournalDraft(payload: PostJournalRequest, role: Role = 'accountant', userId: number = 1) {
  return apiFetch<{ journal_id: number }>(`/journals/draft`, { method: 'POST', body: JSON.stringify(payload) }, role, userId);
}

export async function reviewJournal(id: number, role: Role = 'accountant', userId: number = 1) {
  return apiFetch<{ success: boolean }>(`/journals/${id}/review`, { method: 'PATCH' }, role, userId);
}

export async function deleteJournal(id: number, role: Role = 'accountant') {
  return apiFetch<void>(`/journals/${id}`, { method: 'DELETE' }, role);
}

export async function postJournalFromDraft(id: number, role: Role = 'accountant', userId: number = 1) {
  return apiFetch<{ journal_id: number }>(`/journals/${id}/post`, { method: 'POST' }, role, userId);
}

export type LedgerEntryDTO = {
  id: number;
  account_id: number;
  journal_line_id: number;
  date: string; // ISO date
  debit: string; // numeric as string
  credit: string;
  balance_after: string;
  created_at: string;
};

export async function getLedger(params: { accountId?: number; start?: string; end?: string; limit?: number; offset?: number }, role: Role = 'accountant') {
  const qs = new URLSearchParams();
  if (params.accountId) qs.set('account_id', String(params.accountId));
  if (params.start) qs.set('start', params.start);
  if (params.end) qs.set('end', params.end);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const q = qs.toString();
  const path = `/ledger${q ? `?${q}` : ''}`;
  return apiFetch<{ items: LedgerEntryDTO[]; total?: number }>(path, { method: 'GET' }, role);
}

// ============================================================================
// TAX REPORTS
// ============================================================================

export type TaxReturnDTO = {
  id: number;
  type: 'VAT' | 'Employee_Tax' | 'Provisional_Tax' | 'Income_Tax';
  period_start: string; // ISO date
  period_end: string;
  due_date: string;
  status: 'draft' | 'reviewed' | 'submitted';
  submitted_date?: string | null;
  amount: string; // numeric as string
  reference?: string | null;
  notes?: string | null;
  created_by?: number | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxReturnLineDTO = {
  id: number;
  tax_return_id: number;
  description: string;
  account_id?: number | null;
  amount: string; // numeric as string
  is_manual_override: boolean;
  created_at: string;
};

export type TaxLiabilityDTO = {
  account_id: number;
  code: string;
  name: string;
  amount: string; // numeric as string
};

export type UpcomingTaxReturnDTO = {
  type: string;
  period_start: string; // ISO date
  period_end: string;
  due_date: string;
  suggested_amount: string; // numeric as string
};

export type CreateTaxReturnRequest = {
  type: 'VAT' | 'Employee_Tax' | 'Provisional_Tax' | 'Income_Tax';
  period_start: string;
  period_end: string;
  due_date: string;
};

export type UpdateTaxReturnRequest = {
  amount?: number;
  reference?: string;
  notes?: string;
  lines?: Array<{
    description: string;
    account_id?: number;
    amount: number;
  }>;
};

// Get all tax returns with optional filters
export async function getTaxReports(
  params?: { type?: string; year?: string; status?: string },
  role: Role = 'accountant'
) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.year) qs.set('year', params.year);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  const path = `/tax-reports${q ? `?${q}` : ''}`;
  return apiFetch<{ items: TaxReturnDTO[] }>(path, { method: 'GET' }, role);
}

// Get single tax return with line items
export async function getTaxReport(id: number, role: Role = 'accountant') {
  return apiFetch<{ taxReturn: TaxReturnDTO; lines: TaxReturnLineDTO[] }>(
    `/tax-reports/${id}`,
    { method: 'GET' },
    role
  );
}

// Create new tax return (auto-calculates amount)
export async function createTaxReturn(
  payload: CreateTaxReturnRequest,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<TaxReturnDTO & { lines?: TaxReturnLineDTO[] }>(
    `/tax-reports`,
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Update tax return (manual override)
export async function updateTaxReturn(
  id: number,
  payload: UpdateTaxReturnRequest,
  role: Role = 'accountant'
) {
  return apiFetch<TaxReturnDTO>(
    `/tax-reports/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    role
  );
}

// Review tax return (draft -> reviewed)
export async function reviewTaxReturn(
  id: number,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<{ success: boolean }>(
    `/tax-reports/${id}/review`,
    { method: 'PATCH' },
    role,
    userId
  );
}

// Submit tax return (draft/reviewed -> submitted)
export async function submitTaxReturn(
  id: number,
  role: Role = 'accountant',
  userId?: number,
  submittedDate?: string
) {
  const body = submittedDate ? JSON.stringify({ submitted_date: submittedDate }) : undefined;
  return apiFetch<{ success: boolean }>(
    `/tax-reports/${id}/submit`,
    { method: 'PATCH', body },
    role,
    userId
  );
}

// Delete tax return (draft only)
export async function deleteTaxReturn(id: number, role: Role = 'accountant') {
  return apiFetch<void>(`/tax-reports/${id}`, { method: 'DELETE' }, role);
}

// Get current tax liabilities from ledger
export async function getTaxLiabilities(role: Role = 'accountant') {
  return apiFetch<{ items: TaxLiabilityDTO[] }>(`/tax-liabilities`, { method: 'GET' }, role);
}

// Get upcoming tax deadlines (suggestions)
export async function getUpcomingTaxReturns(role: Role = 'accountant') {
  return apiFetch<{ items: UpcomingTaxReturnDTO[] }>(
    `/tax-reports/upcoming`,
    { method: 'GET' },
    role
  );
}

// Export tax return as Excel
export async function exportTaxReturn(id: number, role: Role = 'accountant'): Promise<Blob> {
  // Build the URL
  const url = `${API_BASE}/tax-reports/${id}/export`;

  // Get access token if available
  let token: string | null = null;
  try {
    token = getAccessToken();
  } catch (error) {
    console.warn('[exportTaxReturn] Could not retrieve access token, continuing without it:', error);
  }

  const headers: Record<string, string> = {
    'X-Role': role,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    // Try to extract error message
    let errorMessage = `${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && (errorData.message || errorData.error)) {
        errorMessage = errorData.message || errorData.error;
      }
    } catch {
      // If JSON parsing fails, use text
      try {
        const errorText = await response.text();
        if (errorText) errorMessage = errorText;
      } catch {
        // Ignore
      }
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}