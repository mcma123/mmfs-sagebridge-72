export type ValidationStatus = 'valid' | 'invalid' | 'duplicate' | 'unmapped';

export interface ImportSessionTotals {
  count: number;
  valid: number;
  invalid: number;
  duplicate: number;
  excluded: number;
  debitTotal: number;
  creditTotal: number;
}

export interface ImportSession {
  id: string;
  userId: string;
  createdAt: string;
  fileName: string;
  fileHash: string;
  status: 'new' | 'mapped' | 'staged' | 'committed' | 'cancelled';
  totals: ImportSessionTotals;
  mappingTemplateId?: string;
}

export type SystemField = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'accountCode' | 'reference' | 'currency';

export interface ImportMappingTemplate {
  id: string;
  name: string;
  bank: string;
  headerMap: Record<string, SystemField>;
  transforms?: {
    invertSigns?: boolean;
    fixedCurrency?: string | null;
    defaultAccountCode?: string | null;
  };
}

export interface NormalizedTransaction {
  id: string;
  sessionId: string;
  rowIndex: number;
  date: string | null;
  description: string | null;
  amount: number | null;
  debit?: number | null;
  credit?: number | null;
  accountCode?: string | null;
  reference?: string | null;
  currency?: string | null;
  validationStatus: ValidationStatus;
  duplicateFlag: boolean;
  excluded?: boolean;
  editHistory: Array<{ field: SystemField; oldValue: any; newValue: any; timestamp: string }>;
  rowHash: string;
}

export interface ImportError {
  id: string;
  sessionId: string;
  rowIndex: number;
  field: SystemField;
  code: string;
  message: string;
}

export interface ImportAuditEvent {
  id: string;
  sessionId: string;
  actorId: string;
  timestamp: string;
  action: string;
  details: any;
}

export interface DestinationSelection {
  journalEntries: boolean;
  trialBalance: boolean;
  chartOfAccounts: boolean;
  aggregation?: 'none' | 'by_date' | 'by_account';
}

export interface CommitResult {
  sessionId: string;
  success: boolean;
  committedRows: number;
  errors: ImportError[];
  reportUrl?: string;
}