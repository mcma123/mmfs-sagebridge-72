// Lightweight local store for accounting defaults (account selections, etc.)

export type AccountingDefaults = {
  arAccountId?: number | null;
  premiumIncomeAccountId?: number | null;
  commissionExpenseAccountId?: number | null;
  apAccountId?: number | null;
  premiumRefundAccountId?: number | null;
  deductionIncomeAccountId?: number | null;
  // MMFS-specific settings
  mmfsIncomeAccountId?: number | null;
  mmfsIncomeBalancingAccountId?: number | null;
};

const LS_KEY = 'accounting_defaults_v1';

export function getAccountingDefaults(): AccountingDefaults {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAccountingDefaults(defs: AccountingDefaults) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(defs || {}));
  } catch {
    // ignore
  }
}