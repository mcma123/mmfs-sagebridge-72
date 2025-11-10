/**
 * Accounts Payable aging report generation
 */

import type { LedgerEntryDTO, EntityDTO } from '@/lib/api/accounting';
import { daysBetween } from './utils';

export interface APAgingEntity {
  entityId: number;
  entityName: string;
  current: number; // 0-30 days
  days30: number; // 31-60 days
  days60: number; // 61-90 days
  days90: number; // 90+ days
  total: number;
  comparisonTotal?: number;
}

export interface APAgingSummary {
  totalCurrent: number;
  totalDays30: number;
  totalDays60: number;
  totalDays90: number;
  grandTotal: number;
  comparisonGrandTotal?: number;
}

export interface APAgingData {
  asOfDate: string;
  comparisonDate?: string;
  entities: APAgingEntity[];
  summary: APAgingSummary;
  dpo?: number; // Days Payable Outstanding
}

/**
 * Calculate aging buckets for a payable transaction
 */
function calculateAgingBucket(transactionDate: string, asOfDate: string): {
  current: number;
  days30: number;
  days60: number;
  days90: number;
} {
  const days = daysBetween(transactionDate, asOfDate);

  if (days <= 30) {
    return { current: 1, days30: 0, days60: 0, days90: 0 };
  } else if (days <= 60) {
    return { current: 0, days30: 1, days60: 0, days90: 0 };
  } else if (days <= 90) {
    return { current: 0, days30: 0, days60: 1, days90: 0 };
  } else {
    return { current: 0, days30: 0, days60: 0, days90: 1 };
  }
}

/**
 * Generate AP aging report from ledger entries
 *
 * AP accounts have credit normal balance (increases with credits, decreases with debits)
 */
export function generateAPAgingReport(
  ledgerEntries: LedgerEntryDTO[],
  entities: EntityDTO[],
  payableAccountIds: number[],
  asOfDate: string,
  comparisonLedgerEntries?: LedgerEntryDTO[],
  comparisonDate?: string
): APAgingData {
  // Filter ledger entries for AP accounts only, up to asOfDate
  const apEntries = ledgerEntries.filter(
    entry =>
      payableAccountIds.includes(entry.account_id) &&
      new Date(entry.date) <= new Date(asOfDate) &&
      entry.entity_id // Only entries with entity assignment
  );

  // Create entity map for quick lookup
  const entityMap = new Map<number, string>();
  entities.forEach(entity => {
    entityMap.set(entity.id, entity.name);
  });

  // Group entries by entity and calculate outstanding balances with aging
  const entityAgingMap = new Map<number, APAgingEntity>();

  apEntries.forEach(entry => {
    const entityId = entry.entity_id!;
    const entityName = entityMap.get(entityId) || `Entity ${entityId}`;

    if (!entityAgingMap.has(entityId)) {
      entityAgingMap.set(entityId, {
        entityId,
        entityName,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        total: 0,
      });
    }

    const entity = entityAgingMap.get(entityId)!;

    // AP increases with credits, decreases with debits
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;
    const amount = credit - debit;

    // Only process if there's a credit balance (we owe vendor)
    if (amount > 0) {
      const bucket = calculateAgingBucket(entry.date, asOfDate);

      entity.current += amount * bucket.current;
      entity.days30 += amount * bucket.days30;
      entity.days60 += amount * bucket.days60;
      entity.days90 += amount * bucket.days90;
      entity.total += amount;
    }
  });

  // Add comparison period data
  if (comparisonLedgerEntries && comparisonDate) {
    const comparisonAPEntries = comparisonLedgerEntries.filter(
      entry =>
        payableAccountIds.includes(entry.account_id) &&
        new Date(entry.date) <= new Date(comparisonDate) &&
        entry.entity_id
    );

    const comparisonTotals = new Map<number, number>();

    comparisonAPEntries.forEach(entry => {
      const entityId = entry.entity_id!;
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      const amount = credit - debit;

      if (amount > 0) {
        comparisonTotals.set(entityId, (comparisonTotals.get(entityId) || 0) + amount);
      }
    });

    // Add comparison totals to entities
    entityAgingMap.forEach((entity, entityId) => {
      entity.comparisonTotal = comparisonTotals.get(entityId) || 0;
    });

    // Add entities that existed in comparison but not current
    comparisonTotals.forEach((total, entityId) => {
      if (!entityAgingMap.has(entityId)) {
        const entityName = entityMap.get(entityId) || `Entity ${entityId}`;
        entityAgingMap.set(entityId, {
          entityId,
          entityName,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          total: 0,
          comparisonTotal: total,
        });
      }
    });
  }

  // Convert to array and filter out zero balances, sort by total descending
  const entitiesArray = Array.from(entityAgingMap.values())
    .filter(entity => entity.total > 0 || (entity.comparisonTotal && entity.comparisonTotal > 0))
    .sort((a, b) => b.total - a.total);

  // Calculate summary totals
  const summary: APAgingSummary = {
    totalCurrent: 0,
    totalDays30: 0,
    totalDays60: 0,
    totalDays90: 0,
    grandTotal: 0,
    comparisonGrandTotal: comparisonDate ? 0 : undefined,
  };

  entitiesArray.forEach(entity => {
    summary.totalCurrent += entity.current;
    summary.totalDays30 += entity.days30;
    summary.totalDays60 += entity.days60;
    summary.totalDays90 += entity.days90;
    summary.grandTotal += entity.total;
    if (comparisonDate && entity.comparisonTotal !== undefined) {
      summary.comparisonGrandTotal = (summary.comparisonGrandTotal || 0) + entity.comparisonTotal;
    }
  });

  // Calculate DPO (Days Payable Outstanding)
  // DPO = (Average AP / COGS) * Days in Period
  // Simplified weighted average based on aging buckets
  const dpo = summary.grandTotal > 0
    ? Math.round(
        (summary.current * 15 + summary.totalDays30 * 45 + summary.totalDays60 * 75 + summary.totalDays90 * 120) /
        summary.grandTotal
      )
    : 0;

  return {
    asOfDate,
    comparisonDate,
    entities: entitiesArray,
    summary,
    dpo,
  };
}

/**
 * Get top N vendors by outstanding balance
 */
export function getTopVendors(data: APAgingData, n: number = 10): APAgingEntity[] {
  return data.entities.slice(0, n);
}

/**
 * Calculate percentage of AP that is overdue (>30 days)
 */
export function getOverduePercentage(data: APAgingData): number {
  if (data.summary.grandTotal === 0) return 0;

  const overdue = data.summary.totalDays30 + data.summary.totalDays60 + data.summary.totalDays90;
  return (overdue / data.summary.grandTotal) * 100;
}
