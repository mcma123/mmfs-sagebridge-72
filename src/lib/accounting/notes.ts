// Mapping helpers to convert debit/credit note forms into accounting journal payloads
import type { JournalLineInput, PostJournalRequest } from '@/lib/api/accounting';

export type DebitNoteFormInput = {
  issuedTo: string;
  issuedToAddress: string;
  insured: string;
  coverType: string;
  policyRef: string;
  periodFrom: string; // yyyy-mm-dd
  periodTo: string;   // yyyy-mm-dd
  grossPremium: string; // number as string
  ourSharePercentage: string; // number as string
  commissionPercentage: string; // number as string
  currency: string; // e.g. 'USD'
  paymentTerms: string;
  preparedBy: string;
  notes?: string;
};

export type CreditNoteFormInput = {
  issuedTo: string;
  issuedToAddress: string;
  retroCedant?: string;
  insured: string;
  coverType: string;
  policyRef: string;
  periodFrom: string; // yyyy-mm-dd
  periodTo: string;   // yyyy-mm-dd
  grossPremium: string; // number as string
  yourSharePercentage: string; // number as string
  deductionPercentage: string; // number as string
  currency: string; // e.g. 'USD'
  paymentTerms: string;
  preparedBy: string;
  notes?: string;
};

export type DebitAccountsSelection = {
  arAccountId: number; // Accounts Receivable
  premiumIncomeAccountId: number; // Premium Income (revenue)
  commissionExpenseAccountId: number; // Commission Expense
};

export type CreditAccountsSelection = {
  apAccountId: number; // Accounts Payable (liability)
  premiumRefundAccountId: number; // Premium Refunds (contra-revenue or expense)
  deductionIncomeAccountId: number; // Recovery/Income for deductions
};

export function makeNoteRef(type: 'debit' | 'credit', when: Date = new Date()): string {
  const prefix = type === 'debit' ? 'DN' : 'CN';
  const year = when.getFullYear();
  const seq = String(when.getTime()).slice(-6);
  return `${prefix}-${year}-${seq}`;
}

export function round2(n: number): number { return Math.round(n * 100) / 100; }

export function validateBalanced(lines: JournalLineInput[]): boolean {
  const totals = lines.reduce((acc, l) => ({
    debit: acc.debit + (l.debit || 0),
    credit: acc.credit + (l.credit || 0),
  }), { debit: 0, credit: 0 });
  return round2(totals.debit) === round2(totals.credit);
}

export function buildDebitJournal(
  form: DebitNoteFormInput,
  entityId: number | null,
  accounts: DebitAccountsSelection,
  postDateISO: string,
): PostJournalRequest {
  const gross = parseFloat(form.grossPremium || '0');
  const ourSharePct = parseFloat(form.ourSharePercentage || '0');
  const commissionPct = parseFloat(form.commissionPercentage || '0');
  const ourShareAmt = round2(gross * ourSharePct / 100);
  const commissionAmt = round2(ourShareAmt * commissionPct / 100);
  const netDue = round2(ourShareAmt - commissionAmt);

  const memoBase = {
    currency: form.currency,
    preparedBy: form.preparedBy,
    paymentTerms: form.paymentTerms,
    policyRef: form.policyRef,
    coverType: form.coverType,
    insured: form.insured,
  };

  const lines: JournalLineInput[] = [
    {
      account_id: accounts.arAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: netDue,
      credit: 0,
      memo: JSON.stringify({ ...memoBase, kind: 'AR', netDue }),
    },
    {
      account_id: accounts.premiumIncomeAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: 0,
      credit: ourShareAmt,
      memo: JSON.stringify({ ...memoBase, kind: 'PremiumIncome', ourShareAmt }),
    },
    {
      account_id: accounts.commissionExpenseAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: commissionAmt,
      credit: 0,
      memo: JSON.stringify({ ...memoBase, kind: 'CommissionExpense', commissionAmt }),
    },
  ];

  if (!validateBalanced(lines)) {
    throw new Error('Debit note journal is not balanced');
  }

  const description = `Debit Note: NetDue ${form.currency} ${netDue.toFixed(2)}; Entity ${form.issuedTo}; Policy ${form.policyRef}; Cover ${form.coverType}`;

  return {
    date: postDateISO,
    reference: makeNoteRef('debit', new Date(postDateISO)),
    description,
    lines,
  };
}

export function buildCreditJournal(
  form: CreditNoteFormInput,
  entityId: number | null,
  accounts: CreditAccountsSelection,
  postDateISO: string,
): PostJournalRequest {
  const gross = parseFloat(form.grossPremium || '0');
  const yourSharePct = parseFloat(form.yourSharePercentage || '0');
  const deductionPct = parseFloat(form.deductionPercentage || '0');
  const yourShareAmt = round2(gross * yourSharePct / 100);
  const deductionAmt = round2(yourShareAmt * deductionPct / 100);
  const netDueToYou = round2(yourShareAmt - deductionAmt);

  const memoBase = {
    currency: form.currency,
    preparedBy: form.preparedBy,
    paymentTerms: form.paymentTerms,
    policyRef: form.policyRef,
    coverType: form.coverType,
    insured: form.insured,
    retroCedant: form.retroCedant || null,
  };

  const lines: JournalLineInput[] = [
    {
      account_id: accounts.apAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: 0,
      credit: netDueToYou,
      memo: JSON.stringify({ ...memoBase, kind: 'AP', netDueToYou }),
    },
    {
      account_id: accounts.premiumRefundAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: yourShareAmt,
      credit: 0,
      memo: JSON.stringify({ ...memoBase, kind: 'PremiumRefund', yourShareAmt }),
    },
    {
      account_id: accounts.deductionIncomeAccountId,
      entity_id: entityId ?? null,
      date: postDateISO,
      debit: 0,
      credit: deductionAmt,
      memo: JSON.stringify({ ...memoBase, kind: 'DeductionIncome', deductionAmt }),
    },
  ];

  if (!validateBalanced(lines)) {
    throw new Error('Credit note journal is not balanced');
  }

  const description = `Credit Note: NetDueToYou ${form.currency} ${netDueToYou.toFixed(2)}; Entity ${form.issuedTo}; Policy ${form.policyRef}; Cover ${form.coverType}`;

  return {
    date: postDateISO,
    reference: makeNoteRef('credit', new Date(postDateISO)),
    description,
    lines,
  };
}