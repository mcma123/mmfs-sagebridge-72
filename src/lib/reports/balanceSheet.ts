/**
 * Balance Sheet report generation
 */

import type { TrialBalanceDTO } from '@/lib/api/accounting';

export interface BalanceSheetAccount {
  id: number;
  code: string;
  name: string;
  current: number;
  comparison?: number;
}

export interface BalanceSheetData {
  asOfDate: string;
  comparisonDate?: string;
  assets: BalanceSheetAccount[];
  liabilities: BalanceSheetAccount[];
  equity: BalanceSheetAccount[];
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    comparisonTotalAssets?: number;
    comparisonTotalLiabilities?: number;
    comparisonTotalEquity?: number;
  };
}

/**
 * Generate Balance Sheet data from trial balance
 *
 * Assets = Liabilities + Equity (accounting equation)
 *
 * Account types:
 * - Asset accounts: Positive balance appears on debit side
 * - Liability accounts: Positive balance appears on credit side
 * - Equity accounts: Positive balance appears on credit side
 */
export function generateBalanceSheet(
  currentTrialBalance: TrialBalanceDTO[],
  asOfDate: string,
  comparisonTrialBalance?: TrialBalanceDTO[],
  comparisonDate?: string
): BalanceSheetData {
  const assets: BalanceSheetAccount[] = [];
  const liabilities: BalanceSheetAccount[] = [];
  const equity: BalanceSheetAccount[] = [];

  // Create a map of comparison data for easy lookup
  const comparisonMap = new Map<number, number>();
  if (comparisonTrialBalance) {
    comparisonTrialBalance.forEach(item => {
      comparisonMap.set(item.account_id, Number(item.balance) || 0);
    });
  }

  // Categorize current period accounts
  currentTrialBalance.forEach(item => {
    const account: BalanceSheetAccount = {
      id: item.account_id,
      code: item.code,
      name: item.name,
      current: Number(item.balance) || 0,
      comparison: comparisonMap.get(item.account_id),
    };

    // Categorize by account type
    if (item.type === 'Asset') {
      assets.push(account);
    } else if (item.type === 'Liability') {
      liabilities.push(account);
    } else if (item.type === 'Equity') {
      equity.push(account);
    }
  });

  // Add comparison accounts that don't exist in current period
  if (comparisonTrialBalance) {
    const currentIds = new Set(currentTrialBalance.map(item => item.account_id));

    comparisonTrialBalance.forEach(item => {
      if (!currentIds.has(item.account_id)) {
        const account: BalanceSheetAccount = {
          id: item.account_id,
          code: item.code,
          name: item.name,
          current: 0,
          comparison: Number(item.balance) || 0,
        };

        if (item.type === 'Asset') {
          assets.push(account);
        } else if (item.type === 'Liability') {
          liabilities.push(account);
        } else if (item.type === 'Equity') {
          equity.push(account);
        }
      }
    });
  }

  // Sort by code
  const sortByCode = (a: BalanceSheetAccount, b: BalanceSheetAccount) =>
    a.code.localeCompare(b.code);

  assets.sort(sortByCode);
  liabilities.sort(sortByCode);
  equity.sort(sortByCode);

  // Calculate totals
  const totalAssets = assets.reduce((sum, acc) => sum + acc.current, 0);
  const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.current, 0);
  const totalEquity = equity.reduce((sum, acc) => sum + acc.current, 0);

  const comparisonTotalAssets = comparisonTrialBalance
    ? assets.reduce((sum, acc) => sum + (acc.comparison || 0), 0)
    : undefined;
  const comparisonTotalLiabilities = comparisonTrialBalance
    ? liabilities.reduce((sum, acc) => sum + (acc.comparison || 0), 0)
    : undefined;
  const comparisonTotalEquity = comparisonTrialBalance
    ? equity.reduce((sum, acc) => sum + (acc.comparison || 0), 0)
    : undefined;

  return {
    asOfDate,
    comparisonDate,
    assets,
    liabilities,
    equity,
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      comparisonTotalAssets,
      comparisonTotalLiabilities,
      comparisonTotalEquity,
    },
  };
}

/**
 * Validate the accounting equation: Assets = Liabilities + Equity
 */
export function validateAccountingEquation(data: BalanceSheetData): {
  isBalanced: boolean;
  difference: number;
} {
  const { totalAssets, totalLiabilities, totalEquity } = data.totals;
  const difference = totalAssets - (totalLiabilities + totalEquity);

  // Allow for rounding errors within 0.01
  const isBalanced = Math.abs(difference) < 0.01;

  return { isBalanced, difference };
}
