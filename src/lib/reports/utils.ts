/**
 * Shared utility functions for financial reports
 */

import { format } from 'date-fns';

/**
 * Calculate variance between current and comparison values
 */
export interface Variance {
  amount: number;
  percentage: number;
  direction: 'increase' | 'decrease' | 'neutral';
}

export function calculateVariance(current: number, comparison: number): Variance {
  const amount = current - comparison;
  const percentage = comparison !== 0 ? (amount / Math.abs(comparison)) * 100 : 0;

  let direction: 'increase' | 'decrease' | 'neutral' = 'neutral';
  if (amount > 0.01) direction = 'increase';
  else if (amount < -0.01) direction = 'decrease';

  return { amount, percentage, direction };
}

/**
 * Format currency in South African Rand (ZAR)
 */
export function formatReportCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage with sign
 */
export function formatPercentage(percentage: number): string {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

/**
 * Calculate trend direction
 */
export type TrendDirection = 'up' | 'down' | 'flat';

export function calculateTrend(currentValue: number, previousValue: number): TrendDirection {
  const diff = currentValue - previousValue;
  if (Math.abs(diff) < 0.01) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

/**
 * Get comparison period date based on current date and comparison type
 */
export type ComparisonType = 'previous-month' | 'previous-quarter' | 'previous-year' | 'custom';

export function getComparisonPeriod(currentDate: Date, type: ComparisonType): Date {
  const date = new Date(currentDate);

  switch (type) {
    case 'previous-month':
      date.setMonth(date.getMonth() - 1);
      break;
    case 'previous-quarter':
      date.setMonth(date.getMonth() - 3);
      break;
    case 'previous-year':
      date.setFullYear(date.getFullYear() - 1);
      break;
    default:
      // custom - return same date, will be overridden by user
      break;
  }

  return date;
}

/**
 * Group ledger entries by period (month, quarter, year)
 */
export type PeriodType = 'month' | 'quarter' | 'year';

export interface PeriodGroup<T> {
  period: string;
  startDate: Date;
  endDate: Date;
  items: T[];
}

export function groupByPeriod<T extends { date: string }>(
  items: T[],
  periodType: PeriodType
): PeriodGroup<T>[] {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const date = new Date(item.date);
    let periodKey: string;

    if (periodType === 'month') {
      periodKey = format(date, 'yyyy-MM');
    } else if (periodType === 'quarter') {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      periodKey = `${date.getFullYear()}-Q${quarter}`;
    } else {
      periodKey = date.getFullYear().toString();
    }

    if (!groups.has(periodKey)) {
      groups.set(periodKey, []);
    }
    groups.get(periodKey)!.push(item);
  });

  // Convert to array and sort by period
  return Array.from(groups.entries())
    .map(([period, items]) => {
      const firstDate = new Date(items[0].date);
      let startDate: Date, endDate: Date;

      if (periodType === 'month') {
        startDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
        endDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
      } else if (periodType === 'quarter') {
        const quarter = Math.floor(firstDate.getMonth() / 3);
        startDate = new Date(firstDate.getFullYear(), quarter * 3, 1);
        endDate = new Date(firstDate.getFullYear(), (quarter + 1) * 3, 0);
      } else {
        startDate = new Date(firstDate.getFullYear(), 0, 1);
        endDate = new Date(firstDate.getFullYear(), 11, 31);
      }

      return { period, startDate, endDate, items };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Calculate days between dates
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get aging bucket label for days overdue
 */
export function getAgingBucket(days: number): string {
  if (days <= 30) return 'Current (0-30)';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return '90+ days';
}

/**
 * Get aging bucket index for sorting
 */
export function getAgingBucketIndex(days: number): number {
  if (days <= 30) return 0;
  if (days <= 60) return 1;
  if (days <= 90) return 2;
  return 3;
}
