/**
 * Tax Summary report generation
 */

import type { TaxReturnDTO, TaxLiabilityDTO } from '@/lib/api/accounting';

export interface QuarterlyVAT {
  quarter: string;
  current: number;
  comparison?: number;
}

export interface TaxSummaryData {
  year: number;
  comparisonYear?: number;
  quarterlyVAT: QuarterlyVAT[];
  currentLiabilities: Array<{
    account: string;
    amount: number;
  }>;
  taxReturns: Array<{
    type: string;
    period: string;
    amount: number;
    status: string;
    dueDate: string;
  }>;
  totals: {
    totalVAT: number;
    totalLiabilities: number;
    comparisonTotalVAT?: number;
  };
}

/**
 * Get quarter from date string
 */
function getQuarter(dateString: string): string {
  const date = new Date(dateString);
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter}`;
}

/**
 * Format tax return type for display
 */
function formatTaxType(type: string): string {
  const typeMap: Record<string, string> = {
    VAT: 'VAT Return',
    Employee_Tax: 'Employee Tax',
    Provisional_Tax: 'Provisional Tax',
    Income_Tax: 'Income Tax',
  };
  return typeMap[type] || type;
}

/**
 * Generate tax summary from tax reports and liabilities
 */
export function generateTaxSummary(
  taxReports: TaxReturnDTO[],
  taxLiabilities: TaxLiabilityDTO[],
  year: number,
  comparisonReports?: TaxReturnDTO[],
  comparisonYear?: number
): TaxSummaryData {
  // Filter VAT returns for the selected year
  const vatReturns = taxReports.filter(
    report =>
      report.type === 'VAT' &&
      new Date(report.period_start).getFullYear() === year
  );

  // Create quarterly VAT map
  const quarterlyMap = new Map<string, QuarterlyVAT>();

  vatReturns.forEach(report => {
    const quarter = getQuarter(report.period_start);

    if (!quarterlyMap.has(quarter)) {
      quarterlyMap.set(quarter, {
        quarter,
        current: 0,
        comparison: 0,
      });
    }

    const qData = quarterlyMap.get(quarter)!;
    qData.current += Number(report.amount) || 0;
  });

  // Add comparison year data
  if (comparisonReports && comparisonYear) {
    const comparisonVATReturns = comparisonReports.filter(
      report =>
        report.type === 'VAT' &&
        new Date(report.period_start).getFullYear() === comparisonYear
    );

    comparisonVATReturns.forEach(report => {
      const quarter = getQuarter(report.period_start);

      if (!quarterlyMap.has(quarter)) {
        quarterlyMap.set(quarter, {
          quarter,
          current: 0,
          comparison: 0,
        });
      }

      const qData = quarterlyMap.get(quarter)!;
      qData.comparison = (qData.comparison || 0) + (Number(report.amount) || 0);
    });
  }

  // Ensure all quarters exist
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
    if (!quarterlyMap.has(q)) {
      quarterlyMap.set(q, {
        quarter: q,
        current: 0,
        comparison: comparisonYear ? 0 : undefined,
      });
    }
  });

  // Convert to array and sort
  const quarterlyVAT = Array.from(quarterlyMap.values()).sort(
    (a, b) => parseInt(a.quarter.slice(1)) - parseInt(b.quarter.slice(1))
  );

  // Format current liabilities
  const currentLiabilities = taxLiabilities.map(liability => ({
    account: `${liability.code} - ${liability.name}`,
    amount: Number(liability.amount) || 0,
  }));

  // Format tax returns for table
  const formattedReturns = taxReports
    .filter(report => new Date(report.period_start).getFullYear() === year)
    .map(report => ({
      type: formatTaxType(report.type),
      period: `${new Date(report.period_start).toLocaleDateString('en-ZA', {
        month: 'short',
        year: 'numeric',
      })} - ${new Date(report.period_end).toLocaleDateString('en-ZA', {
        month: 'short',
        year: 'numeric',
      })}`,
      amount: Number(report.amount) || 0,
      status: report.status || 'draft',
      dueDate: report.due_date,
    }))
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  // Calculate totals
  const totalVAT = quarterlyVAT.reduce((sum, q) => sum + q.current, 0);
  const comparisonTotalVAT = comparisonYear
    ? quarterlyVAT.reduce((sum, q) => sum + (q.comparison || 0), 0)
    : undefined;
  const totalLiabilities = currentLiabilities.reduce((sum, l) => sum + l.amount, 0);

  return {
    year,
    comparisonYear,
    quarterlyVAT,
    currentLiabilities,
    taxReturns: formattedReturns,
    totals: {
      totalVAT,
      totalLiabilities,
      comparisonTotalVAT,
    },
  };
}
