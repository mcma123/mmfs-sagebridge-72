import { describe, it, expect } from 'vitest';
import { buildDebitJournal, buildCreditJournal, validateBalanced, makeNoteRef } from './notes';

describe('accounting note mappers', () => {
  it('builds a balanced debit note journal', () => {
    const form = {
      issuedTo: 'Test Entity',
      issuedToAddress: '123 Road',
      insured: 'Acme Inc',
      coverType: 'Marine',
      policyRef: 'POL-001',
      periodFrom: '2024-01-01',
      periodTo: '2024-01-31',
      grossPremium: '10000',
      ourSharePercentage: '10',
      commissionPercentage: '32.5',
      currency: 'USD',
      paymentTerms: '90 Days',
      preparedBy: 'Tester',
      notes: 'N/A',
    };

    const accounts = {
      arAccountId: 1,
      premiumIncomeAccountId: 2,
      commissionExpenseAccountId: 3,
    };

    const payload = buildDebitJournal(form, 10, accounts, '2024-01-25');
    expect(payload.reference?.startsWith('DN-')).toBe(true);
    expect(payload.date).toBe('2024-01-25');
    expect(validateBalanced(payload.lines)).toBe(true);
    expect(payload.lines).toHaveLength(3);
    // Net due should be your share (10% of 10,000 = 1,000) minus commission (32.5%) = 675
    const ar = payload.lines.find(l => l.account_id === accounts.arAccountId)!;
    expect(ar.debit).toBeCloseTo(675, 2);
    expect(payload.description).toContain('NetDue USD 675.00');
  });

  it('builds a balanced credit note journal', () => {
    const form = {
      issuedTo: 'Test Reinsurer',
      issuedToAddress: '456 Ave',
      retroCedant: 'Cedant X',
      insured: 'Acme Inc',
      coverType: 'Marine',
      policyRef: 'POL-002',
      periodFrom: '2024-02-01',
      periodTo: '2024-02-28',
      grossPremium: '8000',
      yourSharePercentage: '5',
      deductionPercentage: '35',
      currency: 'USD',
      paymentTerms: '90 Days',
      preparedBy: 'Tester',
      notes: 'N/A',
    };

    const accounts = {
      apAccountId: 4,
      premiumRefundAccountId: 5,
      deductionIncomeAccountId: 6,
    };

    const payload = buildCreditJournal(form, 11, accounts, '2024-02-20');
    expect(payload.reference?.startsWith('CN-')).toBe(true);
    expect(validateBalanced(payload.lines)).toBe(true);
    expect(payload.lines).toHaveLength(3);
    // Your share 5% of 8000 = 400, deduction 35% = 140, net due to you = 260
    const ap = payload.lines.find(l => l.account_id === accounts.apAccountId)!;
    expect(ap.credit).toBeCloseTo(260, 2);
    expect(payload.description).toContain('NetDueToYou USD 260.00');
  });
});