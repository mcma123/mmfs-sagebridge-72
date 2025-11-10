/**
 * Expense Report generation
 */

import type { TrialBalanceDTO, LedgerEntryDTO } from '@/lib/api/accounting';
import { groupByPeriod, type PeriodType } from './utils';

export interface ExpenseCategory {
  category: string;
  current: number;
  comparison?: number;
  accounts: Array<{
    id: number;
    code: string;
    name: string;
    amount: number;
  }>;
}

export interface MonthlyExpense {
  month: string;
  amount: number;
  period: Date;
}

export interface ExpenseReportData {
  startDate: string;
  endDate: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  categories: ExpenseCategory[];
  monthlyTrend: MonthlyExpense[];
  totals: {
    totalExpenses: number;
    comparisonTotalExpenses?: number;
  };
}

/**
 * Extract expense category from account name
 * Uses common accounting patterns to categorize expenses
 */
function getCategoryFromAccountName(name: string): string {
  const lowerName = name.toLowerCase();

  // Salary and payroll related
  if (lowerName.includes('salary') || lowerName.includes('payroll') || lowerName.includes('wages')) {
    return 'Salaries & Wages';
  }

  // Rent and utilities
  if (lowerName.includes('rent') || lowerName.includes('lease')) {
    return 'Rent & Lease';
  }

  if (lowerName.includes('utilities') || lowerName.includes('electricity') || lowerName.includes('water')) {
    return 'Utilities';
  }

  // Marketing and advertising
  if (lowerName.includes('marketing') || lowerName.includes('advertising') || lowerName.includes('promotion')) {
    return 'Marketing & Advertising';
  }

  // Office expenses
  if (lowerName.includes('office') || lowerName.includes('supplies') || lowerName.includes('stationery')) {
    return 'Office Expenses';
  }

  // Professional fees
  if (lowerName.includes('professional') || lowerName.includes('legal') || lowerName.includes('consulting')) {
    return 'Professional Fees';
  }

  // Insurance
  if (lowerName.includes('insurance')) {
    return 'Insurance';
  }

  // Travel
  if (lowerName.includes('travel') || lowerName.includes('accommodation') || lowerName.includes('transport')) {
    return 'Travel & Transportation';
  }

  // Depreciation
  if (lowerName.includes('depreciation') || lowerName.includes('amortization')) {
    return 'Depreciation & Amortization';
  }

  // Interest
  if (lowerName.includes('interest')) {
    return 'Interest Expense';
  }

  // Taxes
  if (lowerName.includes('tax') && !lowerName.includes('income tax')) {
    return 'Taxes';
  }

  // Default to "Other Expenses"
  return 'Other Expenses';
}

/**
 * Generate expense report from trial balance and ledger entries
 */
export function generateExpenseReport(
  currentTrialBalance: TrialBalanceDTO[],
  ledgerEntries: LedgerEntryDTO[],
  startDate: string,
  endDate: string,
  comparisonTrialBalance?: TrialBalanceDTO[],
  comparisonStartDate?: string,
  comparisonEndDate?: string
): ExpenseReportData {
  // Filter expense accounts from trial balance
  const currentExpenseAccounts = currentTrialBalance.filter(item => item.type === 'Expense');

  // Create comparison map
  const comparisonMap = new Map<number, number>();
  if (comparisonTrialBalance) {
    comparisonTrialBalance
      .filter(item => item.type === 'Expense')
      .forEach(item => {
        comparisonMap.set(item.account_id, Number(item.balance) || 0);
      });
  }

  // Group expenses by category
  const categoryMap = new Map<string, ExpenseCategory>();

  currentExpenseAccounts.forEach(account => {
    const category = getCategoryFromAccountName(account.name);
    const amount = Number(account.balance) || 0;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        current: 0,
        comparison: 0,
        accounts: [],
      });
    }

    const cat = categoryMap.get(category)!;
    cat.current += amount;
    cat.accounts.push({
      id: account.account_id,
      code: account.code,
      name: account.name,
      amount,
    });
  });

  // Add comparison amounts
  if (comparisonTrialBalance) {
    comparisonTrialBalance
      .filter(item => item.type === 'Expense')
      .forEach(account => {
        const category = getCategoryFromAccountName(account.name);
        const amount = Number(account.balance) || 0;

        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            current: 0,
            comparison: 0,
            accounts: [],
          });
        }

        const cat = categoryMap.get(category)!;
        cat.comparison = (cat.comparison || 0) + amount;
      });
  }

  // Convert to array and sort by amount (descending)
  const categories = Array.from(categoryMap.values()).sort(
    (a, b) => b.current - a.current
  );

  // Calculate monthly trend from ledger entries
  const monthlyGroups = groupByPeriod(ledgerEntries, 'month');
  const monthlyTrend: MonthlyExpense[] = monthlyGroups.map(group => {
    // Sum debits for expense accounts (expenses increase with debits)
    const amount = group.items.reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0);

    return {
      month: group.period,
      amount,
      period: group.startDate,
    };
  });

  // Calculate totals
  const totalExpenses = categories.reduce((sum, cat) => sum + cat.current, 0);
  const comparisonTotalExpenses = comparisonTrialBalance
    ? categories.reduce((sum, cat) => sum + (cat.comparison || 0), 0)
    : undefined;

  return {
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
    categories,
    monthlyTrend,
    totals: {
      totalExpenses,
      comparisonTotalExpenses,
    },
  };
}

/**
 * Get top N expense categories
 */
export function getTopExpenses(
  data: ExpenseReportData,
  n: number = 5
): ExpenseCategory[] {
  return data.categories.slice(0, n);
}
