/**
 * Cash Flow Statement generation
 */

import type { LedgerEntryDTO, AccountDTO } from '@/lib/api/accounting';

export type CashFlowActivity = 'operating' | 'investing' | 'financing';

export interface CashFlowLine {
  description: string;
  current: number;
  comparison?: number;
}

export interface CashFlowData {
  startDate: string;
  endDate: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  operatingActivities: CashFlowLine[];
  investingActivities: CashFlowLine[];
  financingActivities: CashFlowLine[];
  totals: {
    netOperating: number;
    netInvesting: number;
    netFinancing: number;
    netCashFlow: number;
    beginningCash: number;
    endingCash: number;
    comparisonNetCashFlow?: number;
    comparisonEndingCash?: number;
  };
}

/**
 * Categorize account into cash flow activity type
 */
function getCashFlowActivity(account: AccountDTO): CashFlowActivity {
  const name = account.name.toLowerCase();
  const type = account.type;

  // Operating Activities (Income and Expense accounts)
  if (type === 'Income' || type === 'Expense') {
    return 'operating';
  }

  // Investing Activities (Fixed assets, investments)
  if (type === 'Asset') {
    if (
      name.includes('fixed asset') ||
      name.includes('equipment') ||
      name.includes('property') ||
      name.includes('building') ||
      name.includes('land') ||
      name.includes('investment') ||
      name.includes('vehicle') ||
      name.includes('machinery')
    ) {
      return 'investing';
    }
  }

  // Financing Activities (Long-term liabilities and equity)
  if (type === 'Liability') {
    if (
      name.includes('loan') ||
      name.includes('mortgage') ||
      name.includes('bond') ||
      name.includes('note payable') ||
      name.includes('long-term')
    ) {
      return 'financing';
    }
  }

  if (type === 'Equity') {
    if (
      name.includes('capital') ||
      name.includes('dividend') ||
      name.includes('distribution') ||
      name.includes('shares') ||
      name.includes('stock')
    ) {
      return 'financing';
    }
  }

  // Default to operating for everything else (current assets/liabilities)
  return 'operating';
}

/**
 * Calculate net cash flow from ledger entries for a specific period
 */
function calculateCashFlowForPeriod(
  ledgerEntries: LedgerEntryDTO[],
  accounts: AccountDTO[],
  cashAccountIds: number[],
  startDate: string,
  endDate: string
): {
  operatingActivities: Map<string, number>;
  investingActivities: Map<string, number>;
  financingActivities: Map<string, number>;
  beginningCash: number;
  endingCash: number;
} {
  // Create account map
  const accountMap = new Map<number, AccountDTO>();
  accounts.forEach(acc => accountMap.set(acc.id, acc));

  // Filter entries for the period
  const periodEntries = ledgerEntries.filter(
    entry =>
      new Date(entry.date) >= new Date(startDate) &&
      new Date(entry.date) <= new Date(endDate)
  );

  // Calculate beginning and ending cash balances
  const cashEntriesBeforeStart = ledgerEntries.filter(
    entry =>
      cashAccountIds.includes(entry.account_id) &&
      new Date(entry.date) < new Date(startDate)
  );

  const cashEntriesUpToEnd = ledgerEntries.filter(
    entry =>
      cashAccountIds.includes(entry.account_id) &&
      new Date(entry.date) <= new Date(endDate)
  );

  const beginningCash = cashEntriesBeforeStart.reduce((sum, entry) => {
    return sum + (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
  }, 0);

  const endingCash = cashEntriesUpToEnd.reduce((sum, entry) => {
    return sum + (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
  }, 0);

  // Categorize cash flows by activity
  const operatingActivities = new Map<string, number>();
  const investingActivities = new Map<string, number>();
  const financingActivities = new Map<string, number>();

  periodEntries.forEach(entry => {
    // Skip cash accounts themselves (we're calculating changes TO cash)
    if (cashAccountIds.includes(entry.account_id)) {
      return;
    }

    const account = accountMap.get(entry.account_id);
    if (!account) return;

    const activity = getCashFlowActivity(account);
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;

    // For cash flow: we track changes that affect cash
    // Income/Revenue: Credits increase income (cash inflow from operating)
    // Expenses: Debits increase expense (cash outflow from operating)
    // Assets: Debits increase assets (cash outflow from investing)
    // Liabilities/Equity: Credits increase them (cash inflow from financing)

    let cashEffect = 0;
    if (account.type === 'Income') {
      // Income credits are cash inflows
      cashEffect = credit - debit;
    } else if (account.type === 'Expense') {
      // Expense debits are cash outflows (negative)
      cashEffect = -(debit - credit);
    } else if (account.type === 'Asset') {
      // Asset purchases (debits) are cash outflows (negative)
      cashEffect = -(debit - credit);
    } else if (account.type === 'Liability' || account.type === 'Equity') {
      // Liability/Equity increases (credits) are cash inflows
      cashEffect = credit - debit;
    }

    const accountName = account.name;

    // Add to appropriate activity map
    if (activity === 'operating') {
      operatingActivities.set(
        accountName,
        (operatingActivities.get(accountName) || 0) + cashEffect
      );
    } else if (activity === 'investing') {
      investingActivities.set(
        accountName,
        (investingActivities.get(accountName) || 0) + cashEffect
      );
    } else if (activity === 'financing') {
      financingActivities.set(
        accountName,
        (financingActivities.get(accountName) || 0) + cashEffect
      );
    }
  });

  return {
    operatingActivities,
    investingActivities,
    financingActivities,
    beginningCash,
    endingCash,
  };
}

/**
 * Generate Cash Flow Statement
 */
export function generateCashFlowStatement(
  ledgerEntries: LedgerEntryDTO[],
  accounts: AccountDTO[],
  startDate: string,
  endDate: string,
  comparisonLedgerEntries?: LedgerEntryDTO[],
  comparisonStartDate?: string,
  comparisonEndDate?: string
): CashFlowData {
  // Find cash and cash equivalent accounts
  const cashAccountIds = accounts
    .filter(
      acc =>
        acc.name.toLowerCase().includes('cash') ||
        acc.name.toLowerCase().includes('bank') ||
        acc.code.startsWith('1000') // Common code for cash
    )
    .map(acc => acc.id);

  // Calculate current period
  const current = calculateCashFlowForPeriod(
    ledgerEntries,
    accounts,
    cashAccountIds,
    startDate,
    endDate
  );

  // Calculate comparison period
  let comparison:
    | {
        operatingActivities: Map<string, number>;
        investingActivities: Map<string, number>;
        financingActivities: Map<string, number>;
        beginningCash: number;
        endingCash: number;
      }
    | undefined;

  if (comparisonLedgerEntries && comparisonStartDate && comparisonEndDate) {
    comparison = calculateCashFlowForPeriod(
      comparisonLedgerEntries,
      accounts,
      cashAccountIds,
      comparisonStartDate,
      comparisonEndDate
    );
  }

  // Convert maps to arrays
  const operatingActivities: CashFlowLine[] = Array.from(
    current.operatingActivities.entries()
  )
    .map(([description, current]) => ({
      description,
      current,
      comparison: comparison?.operatingActivities.get(description),
    }))
    .filter(line => Math.abs(line.current) > 0.01) // Filter out near-zero amounts
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current)); // Sort by magnitude

  const investingActivities: CashFlowLine[] = Array.from(
    current.investingActivities.entries()
  )
    .map(([description, current]) => ({
      description,
      current,
      comparison: comparison?.investingActivities.get(description),
    }))
    .filter(line => Math.abs(line.current) > 0.01)
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current));

  const financingActivities: CashFlowLine[] = Array.from(
    current.financingActivities.entries()
  )
    .map(([description, current]) => ({
      description,
      current,
      comparison: comparison?.financingActivities.get(description),
    }))
    .filter(line => Math.abs(line.current) > 0.01)
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current));

  // Calculate totals
  const netOperating = operatingActivities.reduce((sum, line) => sum + line.current, 0);
  const netInvesting = investingActivities.reduce((sum, line) => sum + line.current, 0);
  const netFinancing = financingActivities.reduce((sum, line) => sum + line.current, 0);
  const netCashFlow = netOperating + netInvesting + netFinancing;

  const comparisonNetOperating = comparison
    ? Array.from(comparison.operatingActivities.values()).reduce((sum, val) => sum + val, 0)
    : undefined;
  const comparisonNetInvesting = comparison
    ? Array.from(comparison.investingActivities.values()).reduce((sum, val) => sum + val, 0)
    : undefined;
  const comparisonNetFinancing = comparison
    ? Array.from(comparison.financingActivities.values()).reduce((sum, val) => sum + val, 0)
    : undefined;
  const comparisonNetCashFlow =
    comparisonNetOperating !== undefined &&
    comparisonNetInvesting !== undefined &&
    comparisonNetFinancing !== undefined
      ? comparisonNetOperating + comparisonNetInvesting + comparisonNetFinancing
      : undefined;

  return {
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
    operatingActivities,
    investingActivities,
    financingActivities,
    totals: {
      netOperating,
      netInvesting,
      netFinancing,
      netCashFlow,
      beginningCash: current.beginningCash,
      endingCash: current.endingCash,
      comparisonNetCashFlow,
      comparisonEndingCash: comparison?.endingCash,
    },
  };
}
