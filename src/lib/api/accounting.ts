// Lightweight Accounting API client for frontend use
// Follows the pattern used in src/lib/api/documents.ts

import { getAccessToken } from '@/lib/api/auth';

export type Role = 'admin' | 'accountant' | 'editor' | 'viewer';

let API_BASE = '/api/v1/accounting';

export function setAccountingApiBase(base: string) {
  API_BASE = base || '/api/v1/accounting';
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  role: Role = 'accountant',
  userId?: number
): Promise<T> {
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response, leave data as null
  }

  if (!resp.ok) {
    let message = resp.statusText || 'Request failed';

    if (data) {
      // Prefer top-level message if present
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        message = data.message;
      } else if (data.error) {
        // Handle error as string or object with message/code
        if (typeof data.error === 'string') {
          message = data.error;
        } else if (typeof data.error.message === 'string' && data.error.message.trim().length > 0) {
          message = data.error.message;
        } else if (typeof data.error.code === 'string' && data.error.code.trim().length > 0) {
          message = data.error.code;
        }
      }
    }

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

/**
 * Journal/Transaction DTO
 *
 * Payment Tracking Fields:
 * - recorded_at: When the transaction was posted/recorded in the system (same as posted_at)
 * - received_at: When the payment was actually received (set during payment reconciliation)
 * - payment_status: Current payment status of the transaction
 * - paid_amount: Total amount paid/allocated so far
 */
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
  // Payment reconciliation fields
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'reconciled';
  paid_amount?: number;
  recorded_at?: string | null; // When transaction was recorded in system
  received_at?: string | null; // When payment was actually received (from bank reconciliation)
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

/**
 * Delete an account.
 *
 * When cascade is true, the backend will also delete all journal_lines and
 * ledger_entries that reference this account. This is a destructive operation
 * that may leave historical journals unbalanced and should only be used from
 * explicit flows such as the Edit Account page.
 */
export async function deleteAccount(
  id: number,
  role: Role = 'accountant',
  cascade?: boolean
) {
  const qs = cascade ? '?cascade=true' : '';
  return apiFetch<void>(`/accounts/${id}${qs}`, { method: 'DELETE' }, role);
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
 // PERIOD-END AND YEAR-END CHECKLIST
 // ============================================================================

export type PeriodStatus = 'Closed' | 'In Progress' | 'Future';

export type PeriodDTO = {
  id: number;
  period_start: string;
  period_end: string;
  label: string;
  status: PeriodStatus;
  closed_date: string | null;
  closed_by: number | null;
  reconciliations_done: boolean;
  journals_done: boolean;
  accounts_done: boolean;
  taxes_done: boolean;
  reports_done: boolean;
  created_at?: string;
  updated_at?: string;
};

export type YearEndTaskDTO = {
  id: number;
  fiscal_year: number;
  task: string;
  critical: boolean;
  completed: boolean;
  completed_at: string | null;
  completed_by: number | null;
  order_index: number;
  created_at?: string;
  updated_at?: string;
};

// Get accounting periods (optionally filtered by year)
export async function getPeriods(
  params?: { year?: number },
  role: Role = 'accountant'
) {
  const qs = new URLSearchParams();
  if (params?.year) {
    qs.set('year', String(params.year));
  }
  const q = qs.toString();
  const path = `/periods${q ? `?${q}` : ''}`;
  return apiFetch<{ items: PeriodDTO[] }>(path, { method: 'GET' }, role);
}

// Update period status/checklist (soft close)
export async function updatePeriod(
  id: number,
  payload: Partial<{
    status: PeriodStatus;
    reconciliations_done: boolean;
    journals_done: boolean;
    accounts_done: boolean;
    taxes_done: boolean;
    reports_done: boolean;
  }>,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<PeriodDTO>(
    `/periods/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Get year-end checklist tasks for a fiscal year
export async function getYearEndChecklist(
  params?: { year?: number },
  role: Role = 'accountant'
) {
  const qs = new URLSearchParams();
  if (params?.year) {
    qs.set('year', String(params.year));
  }
  const q = qs.toString();
  const path = `/year-end-checklist${q ? `?${q}` : ''}`;
  return apiFetch<{ items: YearEndTaskDTO[] }>(path, { method: 'GET' }, role);
}

// Update year-end checklist task completion
export async function updateYearEndTask(
  id: number,
  completed: boolean,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<YearEndTaskDTO>(
    `/year-end-checklist/${id}`,
    { method: 'PATCH', body: JSON.stringify({ completed }) },
    role,
    userId
  );
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

// ============================================================================
// DEBIT/CREDIT NOTE ACTIONS
// ============================================================================

export type MarkPaidRequest = {
  bank_account_id: number;
  payment_date: string;
  notes?: string;
};

export type MarkPaidResponse = {
  success: boolean;
  journal_id: number;
  payment_journal_id: number;
  amount: number;
  payment_reference: string;
};

export type PartialPaymentRequest = {
  amount: number;
  bank_account_id: number;
  payment_date: string;
  notes?: string;
};

export type PartialPaymentResponse = {
  success: boolean;
  journal_id: number;
  payment_journal_id: number;
  amount: number;
  total_paid: number;
  remaining: number;
  status: string;
  payment_reference: string;
};

export type ReconcilePaymentResponse = {
  success: boolean;
  journal_id: number;
  reconciled_at: string;
};

export type ApplyCreditRequest = {
  debit_note_id: number;
  amount?: number;
  applied_date?: string;
  notes?: string;
};

export type ApplyCreditResponse = {
  success: boolean;
  credit_note_id: number;
  debit_note_id: number;
  application_journal_id: number;
  amount: number;
  application_reference: string;
};

export type MarkRefundPaidRequest = {
  bank_account_id: number;
  payment_date: string;
  notes?: string;
};

export type MarkRefundPaidResponse = {
  success: boolean;
  journal_id: number;
  payment_journal_id: number;
  amount: number;
  payment_reference: string;
};

// Mark debit note as paid (creates payment journal entry)
export async function markNotePaid(
  id: number,
  payload: MarkPaidRequest,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<MarkPaidResponse>(
    `/journals/${id}/mark-paid`,
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Record partial payment for debit note
export async function recordPartialPayment(
  id: number,
  payload: PartialPaymentRequest,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<PartialPaymentResponse>(
    `/journals/${id}/partial-payment`,
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Reconcile payment for debit note
export async function reconcilePayment(
  id: number,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<ReconcilePaymentResponse>(
    `/journals/${id}/reconcile`,
    { method: 'POST' },
    role,
    userId
  );
}

// Apply credit note to debit note
export async function applyCredit(
  creditNoteId: number,
  payload: ApplyCreditRequest,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<ApplyCreditResponse>(
    `/journals/${creditNoteId}/apply-credit`,
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Mark refund paid for credit note
export async function markRefundPaid(
  id: number,
  payload: MarkRefundPaidRequest,
  role: Role = 'accountant',
  userId?: number
) {
  return apiFetch<MarkRefundPaidResponse>(
    `/journals/${id}/refund-paid`,
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Export note as PDF
export async function exportNotePDF(id: number, role: Role = 'accountant'): Promise<Blob> {
  const url = `${API_BASE}/journals/${id}/pdf`;

  let token: string | null = null;
  try {
    token = getAccessToken();
  } catch (error) {
    console.warn('[exportNotePDF] Could not retrieve access token:', error);
  }

  const headers: Record<string, string> = {
    'X-Role': role,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    let errorMessage = `${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && (errorData.message || errorData.error)) {
        errorMessage = errorData.message || errorData.error;
      }
    } catch {
      // Ignore
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}

// ============================================================================
// PAYMENT RECONCILIATION API FUNCTIONS
// ============================================================================

// Types for reconciliation
export type OutstandingReceivable = {
  journal_id: number;
  reference: string;
  journal_date: string;
  description: string;
  entity_name: string | null;
  entity_id: number | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: string;
  recorded_at: string | null;
  received_at: string | null;
  days_outstanding: number;
  aging_bucket: string;
};

export type AvailableCredit = {
  journal_id: number;
  reference: string;
  journal_date: string;
  description: string;
  entity_name: string | null;
  entity_id: number | null;
  total_amount: number;
  applied_amount: number;
  available_amount: number;
  payment_status: string;
};

export type BankTransaction = {
  id: number;
  transaction_date: string;
  reference: string | null;
  description: string | null;
  amount: number;
  entity_name: string | null;
  matched_amount: number;
  unallocated_amount: number;
  status: 'unallocated' | 'matched' | 'partially_matched' | 'ignored';
  batch_description: string | null;
  created_at: string;
};

export type MatchSuggestion = {
  journal_id: number;
  reference: string;
  journal_date: string;
  description: string;
  entity_name: string | null;
  outstanding_amount: number;
  payment_status: string;
  days_outstanding: number;
  match_score: number;
  match_factors: string[];
  confidence: 'high' | 'medium' | 'low';
};

export type PaymentAllocation = {
  journal_id: number;
  amount: number;
  match_score?: number;
  match_type?: string;
};

// Get outstanding receivables (unpaid/partial debit notes)
export async function getOutstandingItems(
  role: Role = 'accountant',
  userId?: number
): Promise<{ items: OutstandingReceivable[] }> {
  return apiFetch<{ items: OutstandingReceivable[] }>(
    '/outstanding-items',
    { method: 'GET' },
    role,
    userId
  );
}

// Get available credit notes
export async function getAvailableCredits(
  role: Role = 'accountant',
  userId?: number
): Promise<{ items: AvailableCredit[] }> {
  return apiFetch<{ items: AvailableCredit[] }>(
    '/available-credits',
    { method: 'GET' },
    role,
    userId
  );
}

// Get unallocated bank transactions
export async function getBankTransactions(
  role: Role = 'accountant',
  userId?: number
): Promise<{ items: BankTransaction[] }> {
  return apiFetch<{ items: BankTransaction[] }>(
    '/bank-transactions',
    { method: 'GET' },
    role,
    userId
  );
}

// Manual entry of bank transaction
export async function createBankTransaction(
  payload: {
    transaction_date: string;
    reference?: string;
    description?: string;
    amount: number;
    entity_name?: string;
    bank_account_id?: number;
    notes?: string;
  },
  role: Role = 'accountant',
  userId?: number
): Promise<BankTransaction> {
  return apiFetch<BankTransaction>(
    '/bank-transactions',
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Import CSV bank statement
export async function importBankStatement(
  payload: {
    transactions: Array<{
      transaction_date?: string;
      date?: string;
      reference?: string;
      description?: string;
      amount: number;
      entity_name?: string;
      bank_account_id?: number;
    }>;
    description?: string;
  },
  role: Role = 'accountant',
  userId?: number
): Promise<{
  batch_id: number;
  imported_count: number;
  message: string;
}> {
  return apiFetch<{
    batch_id: number;
    imported_count: number;
    message: string;
  }>(
    '/bank-transactions/import',
    { method: 'POST', body: JSON.stringify(payload) },
    role,
    userId
  );
}

// Suggest matches for a bank transaction
export async function suggestMatches(
  bankTransactionId: number,
  role: Role = 'accountant',
  userId?: number
): Promise<{ matches: MatchSuggestion[] }> {
  return apiFetch<{ matches: MatchSuggestion[] }>(
    '/reconciliation/suggest-matches',
    { method: 'POST', body: JSON.stringify({ bank_transaction_id: bankTransactionId }) },
    role,
    userId
  );
}

// Apply match(es) - allocate payment to journal(s)
export async function applyMatch(
  bankTransactionId: number,
  allocations: PaymentAllocation[],
  role: Role = 'accountant',
  userId?: number
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    '/reconciliation/apply-match',
    {
      method: 'POST',
      body: JSON.stringify({
        bank_transaction_id: bankTransactionId,
        allocations,
      }),
    },
    role,
    userId
  );
}