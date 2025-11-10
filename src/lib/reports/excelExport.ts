/**
 * Excel export utilities for financial reports using exceljs
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { Variance } from './utils';

/**
 * Common Excel styling
 */
const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
  alignment: { horizontal: 'left', vertical: 'middle' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  },
};

const currencyStyle: Partial<ExcelJS.Style> = {
  numFmt: 'R#,##0.00',
  alignment: { horizontal: 'right' },
};

const percentStyle: Partial<ExcelJS.Style> = {
  numFmt: '0.0"%"',
  alignment: { horizontal: 'right' },
};

const totalRowStyle: Partial<ExcelJS.Style> = {
  font: { bold: true },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } },
  border: {
    top: { style: 'double' },
    bottom: { style: 'double' },
  },
};

/**
 * Create and download an Excel file
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Balance Sheet Excel Export
 */
export interface BalanceSheetData {
  asOfDate: string;
  comparisonDate?: string;
  assets: Array<{ code: string; name: string; current: number; comparison?: number }>;
  liabilities: Array<{ code: string; name: string; current: number; comparison?: number }>;
  equity: Array<{ code: string; name: string; current: number; comparison?: number }>;
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    comparisonTotalAssets?: number;
    comparisonTotalLiabilities?: number;
    comparisonTotalEquity?: number;
  };
}

export async function exportBalanceSheet(
  data: BalanceSheetData,
  filename: string = `balance-sheet-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Balance Sheet');

  const hasComparison = !!data.comparisonDate;

  // Title
  worksheet.mergeCells('A1:D1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Balance Sheet';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // As of Date
  worksheet.mergeCells('A2:D2');
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `As of ${format(new Date(data.asOfDate), 'MMMM dd, yyyy')}`;
  dateCell.alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  // Headers
  const headerRow = worksheet.addRow(
    hasComparison
      ? ['Account Code', 'Account Name', data.asOfDate, data.comparisonDate, 'Change', 'Change %']
      : ['Account Code', 'Account Name', 'Amount']
  );
  headerRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  // Helper function to add section
  const addSection = (
    title: string,
    accounts: Array<{ code: string; name: string; current: number; comparison?: number }>,
    total: number,
    comparisonTotal?: number
  ) => {
    // Section header
    const sectionRow = worksheet.addRow([title]);
    sectionRow.getCell(1).font = { bold: true, size: 12 };
    sectionRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    // Accounts
    accounts.forEach(account => {
      if (hasComparison && account.comparison !== undefined) {
        const change = account.current - account.comparison;
        const changePercent = account.comparison !== 0 ? change / Math.abs(account.comparison) : 0;

        const row = worksheet.addRow([
          account.code,
          account.name,
          account.current,
          account.comparison,
          change,
          changePercent,
        ]);
        row.getCell(3).style = currencyStyle;
        row.getCell(4).style = currencyStyle;
        row.getCell(5).style = currencyStyle;
        row.getCell(6).style = percentStyle;
      } else {
        const row = worksheet.addRow([account.code, account.name, account.current]);
        row.getCell(3).style = currencyStyle;
      }
    });

    // Total row
    if (hasComparison && comparisonTotal !== undefined) {
      const change = total - comparisonTotal;
      const changePercent = comparisonTotal !== 0 ? change / Math.abs(comparisonTotal) : 0;

      const totalRow = worksheet.addRow([
        '',
        `Total ${title}`,
        total,
        comparisonTotal,
        change,
        changePercent,
      ]);
      totalRow.eachCell((cell, colNum) => {
        cell.style = totalRowStyle;
        if (colNum === 3 || colNum === 4 || colNum === 5) {
          cell.style = { ...totalRowStyle, ...currencyStyle };
        } else if (colNum === 6) {
          cell.style = { ...totalRowStyle, ...percentStyle };
        }
      });
    } else {
      const totalRow = worksheet.addRow(['', `Total ${title}`, total]);
      totalRow.eachCell((cell, colNum) => {
        cell.style = totalRowStyle;
        if (colNum === 3) {
          cell.style = { ...totalRowStyle, ...currencyStyle };
        }
      });
    }

    worksheet.addRow([]);
  };

  // Add sections
  addSection('Assets', data.assets, data.totals.totalAssets, data.totals.comparisonTotalAssets);
  addSection(
    'Liabilities',
    data.liabilities,
    data.totals.totalLiabilities,
    data.totals.comparisonTotalLiabilities
  );
  addSection('Equity', data.equity, data.totals.totalEquity, data.totals.comparisonTotalEquity);

  // Column widths
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 35;
  worksheet.getColumn(3).width = 15;
  if (hasComparison) {
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 12;
  }

  await downloadWorkbook(workbook, filename);
}

/**
 * Expense Report Excel Export
 */
export interface ExpenseReportData {
  startDate: string;
  endDate: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  expenses: Array<{
    category: string;
    current: number;
    comparison?: number;
  }>;
  monthlyTrend?: Array<{
    month: string;
    amount: number;
  }>;
}

export async function exportExpenseReport(
  data: ExpenseReportData,
  filename: string = `expense-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = 'Expense Report';
  summarySheet.getCell('A1').font = { size: 16, bold: true };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:D2');
  summarySheet.getCell('A2').value = `${format(
    new Date(data.startDate),
    'MMM dd, yyyy'
  )} - ${format(new Date(data.endDate), 'MMM dd, yyyy')}`;
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };

  summarySheet.addRow([]);

  const hasComparison = !!data.comparisonStartDate;
  const headerRow = summarySheet.addRow(
    hasComparison
      ? ['Category', 'Current Period', 'Previous Period', 'Change', 'Change %']
      : ['Category', 'Amount']
  );
  headerRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  let totalCurrent = 0;
  let totalComparison = 0;

  data.expenses.forEach(expense => {
    totalCurrent += expense.current;
    if (expense.comparison) totalComparison += expense.comparison;

    if (hasComparison && expense.comparison !== undefined) {
      const change = expense.current - expense.comparison;
      const changePercent = expense.comparison !== 0 ? change / Math.abs(expense.comparison) : 0;

      const row = summarySheet.addRow([
        expense.category,
        expense.current,
        expense.comparison,
        change,
        changePercent,
      ]);
      row.getCell(2).style = currencyStyle;
      row.getCell(3).style = currencyStyle;
      row.getCell(4).style = currencyStyle;
      row.getCell(5).style = percentStyle;
    } else {
      const row = summarySheet.addRow([expense.category, expense.current]);
      row.getCell(2).style = currencyStyle;
    }
  });

  // Total row
  if (hasComparison) {
    const change = totalCurrent - totalComparison;
    const changePercent = totalComparison !== 0 ? change / Math.abs(totalComparison) : 0;

    const totalRow = summarySheet.addRow([
      'Total Expenses',
      totalCurrent,
      totalComparison,
      change,
      changePercent,
    ]);
    totalRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum === 2 || colNum === 3 || colNum === 4) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      } else if (colNum === 5) {
        cell.style = { ...totalRowStyle, ...percentStyle };
      }
    });
  } else {
    const totalRow = summarySheet.addRow(['Total Expenses', totalCurrent]);
    totalRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum === 2) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      }
    });
  }

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 18;
  if (hasComparison) {
    summarySheet.getColumn(3).width = 18;
    summarySheet.getColumn(4).width = 15;
    summarySheet.getColumn(5).width = 12;
  }

  // Monthly trend sheet
  if (data.monthlyTrend && data.monthlyTrend.length > 0) {
    const trendSheet = workbook.addWorksheet('Monthly Trend');

    trendSheet.mergeCells('A1:B1');
    trendSheet.getCell('A1').value = 'Monthly Expense Trend';
    trendSheet.getCell('A1').font = { size: 14, bold: true };
    trendSheet.getCell('A1').alignment = { horizontal: 'center' };

    trendSheet.addRow([]);

    const trendHeaderRow = trendSheet.addRow(['Month', 'Amount']);
    trendHeaderRow.eachCell(cell => {
      cell.style = headerStyle;
    });

    data.monthlyTrend.forEach(item => {
      const row = trendSheet.addRow([item.month, item.amount]);
      row.getCell(2).style = currencyStyle;
    });

    trendSheet.getColumn(1).width = 20;
    trendSheet.getColumn(2).width = 18;
  }

  await downloadWorkbook(workbook, filename);
}

/**
 * Tax Summary Excel Export
 */
export interface TaxSummaryData {
  year: number;
  comparisonYear?: number;
  quarterlyVAT: Array<{
    quarter: string;
    current: number;
    comparison?: number;
  }>;
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
}

export async function exportTaxSummary(
  data: TaxSummaryData,
  filename: string = `tax-summary-${data.year}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tax Summary');

  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = `Tax Summary - ${data.year}`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  // Quarterly VAT section
  worksheet.addRow(['Quarterly VAT Summary']).getCell(1).font = { bold: true, size: 12 };
  const hasComparison = !!data.comparisonYear;
  const vatHeaderRow = worksheet.addRow(
    hasComparison ? ['Quarter', data.year.toString(), data.comparisonYear?.toString(), 'Change', 'Change %'] : ['Quarter', 'Amount']
  );
  vatHeaderRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  data.quarterlyVAT.forEach(q => {
    if (hasComparison && q.comparison !== undefined) {
      const change = q.current - q.comparison;
      const changePercent = q.comparison !== 0 ? change / Math.abs(q.comparison) : 0;
      const row = worksheet.addRow([q.quarter, q.current, q.comparison, change, changePercent]);
      row.getCell(2).style = currencyStyle;
      row.getCell(3).style = currencyStyle;
      row.getCell(4).style = currencyStyle;
      row.getCell(5).style = percentStyle;
    } else {
      const row = worksheet.addRow([q.quarter, q.current]);
      row.getCell(2).style = currencyStyle;
    }
  });

  worksheet.addRow([]);

  // Current liabilities section
  worksheet.addRow(['Current Tax Liabilities']).getCell(1).font = { bold: true, size: 12 };
  const liabHeaderRow = worksheet.addRow(['Account', 'Amount']);
  liabHeaderRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  let totalLiabilities = 0;
  data.currentLiabilities.forEach(liability => {
    totalLiabilities += liability.amount;
    const row = worksheet.addRow([liability.account, liability.amount]);
    row.getCell(2).style = currencyStyle;
  });

  const liabTotalRow = worksheet.addRow(['Total Tax Liabilities', totalLiabilities]);
  liabTotalRow.eachCell((cell, colNum) => {
    cell.style = totalRowStyle;
    if (colNum === 2) {
      cell.style = { ...totalRowStyle, ...currencyStyle };
    }
  });

  worksheet.addRow([]);

  // Tax returns section
  worksheet.addRow(['Tax Returns Filed']).getCell(1).font = { bold: true, size: 12 };
  const returnsHeaderRow = worksheet.addRow(['Type', 'Period', 'Amount', 'Status', 'Due Date']);
  returnsHeaderRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  data.taxReturns.forEach(taxReturn => {
    const row = worksheet.addRow([
      taxReturn.type,
      taxReturn.period,
      taxReturn.amount,
      taxReturn.status,
      format(new Date(taxReturn.dueDate), 'MMM dd, yyyy'),
    ]);
    row.getCell(3).style = currencyStyle;
  });

  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 15;
  worksheet.getColumn(5).width = 12;

  await downloadWorkbook(workbook, filename);
}

/**
 * Aging Report Excel Export (for AR and AP)
 */
export interface AgingReportData {
  type: 'AR' | 'AP';
  asOfDate: string;
  comparisonDate?: string;
  entities: Array<{
    name: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    total: number;
    comparisonTotal?: number;
  }>;
  summary: {
    totalCurrent: number;
    totalDays30: number;
    totalDays60: number;
    totalDays90: number;
    grandTotal: number;
    comparisonGrandTotal?: number;
  };
  dso?: number;
  dpo?: number;
}

export async function exportAgingReport(
  data: AgingReportData,
  filename: string = `${data.type.toLowerCase()}-aging-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${data.type} Aging`);

  const title = data.type === 'AR' ? 'Accounts Receivable Aging' : 'Accounts Payable Aging';

  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:G2');
  worksheet.getCell('A2').value = `As of ${format(new Date(data.asOfDate), 'MMMM dd, yyyy')}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  const hasComparison = !!data.comparisonDate;
  const headerRow = worksheet.addRow(
    hasComparison
      ? [data.type === 'AR' ? 'Customer' : 'Vendor', 'Current', '31-60', '61-90', '90+', 'Total', 'Previous Total', 'Change']
      : [data.type === 'AR' ? 'Customer' : 'Vendor', 'Current', '31-60', '61-90', '90+', 'Total']
  );
  headerRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  data.entities.forEach(entity => {
    if (hasComparison && entity.comparisonTotal !== undefined) {
      const change = entity.total - entity.comparisonTotal;
      const row = worksheet.addRow([
        entity.name,
        entity.current,
        entity.days30,
        entity.days60,
        entity.days90,
        entity.total,
        entity.comparisonTotal,
        change,
      ]);
      for (let i = 2; i <= 8; i++) {
        row.getCell(i).style = currencyStyle;
      }
    } else {
      const row = worksheet.addRow([
        entity.name,
        entity.current,
        entity.days30,
        entity.days60,
        entity.days90,
        entity.total,
      ]);
      for (let i = 2; i <= 6; i++) {
        row.getCell(i).style = currencyStyle;
      }
    }
  });

  // Total row
  if (hasComparison && data.summary.comparisonGrandTotal !== undefined) {
    const change = data.summary.grandTotal - data.summary.comparisonGrandTotal;
    const totalRow = worksheet.addRow([
      'Total',
      data.summary.totalCurrent,
      data.summary.totalDays30,
      data.summary.totalDays60,
      data.summary.totalDays90,
      data.summary.grandTotal,
      data.summary.comparisonGrandTotal,
      change,
    ]);
    totalRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum >= 2) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      }
    });
  } else {
    const totalRow = worksheet.addRow([
      'Total',
      data.summary.totalCurrent,
      data.summary.totalDays30,
      data.summary.totalDays60,
      data.summary.totalDays90,
      data.summary.grandTotal,
    ]);
    totalRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum >= 2) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      }
    });
  }

  worksheet.addRow([]);

  // Add DSO/DPO metric
  if (data.dso) {
    const dsoRow = worksheet.addRow(['Days Sales Outstanding (DSO)', data.dso, 'days']);
    dsoRow.getCell(1).font = { bold: true };
  } else if (data.dpo) {
    const dpoRow = worksheet.addRow(['Days Payable Outstanding (DPO)', data.dpo, 'days']);
    dpoRow.getCell(1).font = { bold: true };
  }

  worksheet.getColumn(1).width = 35;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 15;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;
  if (hasComparison) {
    worksheet.getColumn(7).width = 15;
    worksheet.getColumn(8).width = 15;
  }

  await downloadWorkbook(workbook, filename);
}

/**
 * Cash Flow Statement Excel Export
 */
export interface CashFlowData {
  startDate: string;
  endDate: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  operatingActivities: Array<{ description: string; current: number; comparison?: number }>;
  investingActivities: Array<{ description: string; current: number; comparison?: number }>;
  financingActivities: Array<{ description: string; current: number; comparison?: number }>;
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

export async function exportCashFlow(
  data: CashFlowData,
  filename: string = `cash-flow-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cash Flow Statement');

  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = 'Cash Flow Statement';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:D2');
  worksheet.getCell('A2').value = `${format(new Date(data.startDate), 'MMM dd, yyyy')} - ${format(
    new Date(data.endDate),
    'MMM dd, yyyy'
  )}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  const hasComparison = !!data.comparisonStartDate;
  const headerRow = worksheet.addRow(
    hasComparison
      ? ['Activity', 'Current Period', 'Previous Period', 'Change']
      : ['Activity', 'Amount']
  );
  headerRow.eachCell(cell => {
    cell.style = headerStyle;
  });

  // Helper to add section
  const addSection = (
    title: string,
    activities: Array<{ description: string; current: number; comparison?: number }>,
    netTotal: number,
    comparisonTotal?: number
  ) => {
    const sectionRow = worksheet.addRow([title]);
    sectionRow.getCell(1).font = { bold: true, size: 11 };
    sectionRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    activities.forEach(activity => {
      if (hasComparison && activity.comparison !== undefined) {
        const change = activity.current - activity.comparison;
        const row = worksheet.addRow([
          activity.description,
          activity.current,
          activity.comparison,
          change,
        ]);
        row.getCell(2).style = currencyStyle;
        row.getCell(3).style = currencyStyle;
        row.getCell(4).style = currencyStyle;
      } else {
        const row = worksheet.addRow([activity.description, activity.current]);
        row.getCell(2).style = currencyStyle;
      }
    });

    if (hasComparison && comparisonTotal !== undefined) {
      const change = netTotal - comparisonTotal;
      const totalRow = worksheet.addRow([
        `Net Cash from ${title}`,
        netTotal,
        comparisonTotal,
        change,
      ]);
      totalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true };
        if (colNum >= 2) {
          cell.style = { font: { bold: true }, ...currencyStyle };
        }
      });
    } else {
      const totalRow = worksheet.addRow([`Net Cash from ${title}`, netTotal]);
      totalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true };
        if (colNum === 2) {
          cell.style = { font: { bold: true }, ...currencyStyle };
        }
      });
    }

    worksheet.addRow([]);
  };

  addSection(
    'Operating Activities',
    data.operatingActivities,
    data.totals.netOperating,
    hasComparison ? data.comparisonStartDate ? data.totals.netOperating : undefined : undefined
  );
  addSection(
    'Investing Activities',
    data.investingActivities,
    data.totals.netInvesting,
    hasComparison ? data.comparisonStartDate ? data.totals.netInvesting : undefined : undefined
  );
  addSection(
    'Financing Activities',
    data.financingActivities,
    data.totals.netFinancing,
    hasComparison ? data.comparisonStartDate ? data.totals.netFinancing : undefined : undefined
  );

  // Net change in cash
  if (hasComparison && data.totals.comparisonNetCashFlow !== undefined) {
    const change = data.totals.netCashFlow - data.totals.comparisonNetCashFlow;
    const netChangeRow = worksheet.addRow([
      'Net Change in Cash',
      data.totals.netCashFlow,
      data.totals.comparisonNetCashFlow,
      change,
    ]);
    netChangeRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum >= 2) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      }
    });
  } else {
    const netChangeRow = worksheet.addRow(['Net Change in Cash', data.totals.netCashFlow]);
    netChangeRow.eachCell((cell, colNum) => {
      cell.style = totalRowStyle;
      if (colNum === 2) {
        cell.style = { ...totalRowStyle, ...currencyStyle };
      }
    });
  }

  // Beginning and ending cash
  worksheet.addRow(['Beginning Cash', data.totals.beginningCash]).getCell(2).style = currencyStyle;

  if (hasComparison && data.totals.comparisonEndingCash !== undefined) {
    const change = data.totals.endingCash - data.totals.comparisonEndingCash;
    const endingRow = worksheet.addRow([
      'Ending Cash',
      data.totals.endingCash,
      data.totals.comparisonEndingCash,
      change,
    ]);
    endingRow.eachCell((cell, colNum) => {
      cell.font = { bold: true };
      if (colNum >= 2) {
        cell.style = { font: { bold: true }, ...currencyStyle };
      }
    });
  } else {
    const endingRow = worksheet.addRow(['Ending Cash', data.totals.endingCash]);
    endingRow.eachCell((cell, colNum) => {
      cell.font = { bold: true };
      if (colNum === 2) {
        cell.style = { font: { bold: true }, ...currencyStyle };
      }
    });
  }

  worksheet.getColumn(1).width = 40;
  worksheet.getColumn(2).width = 18;
  if (hasComparison) {
    worksheet.getColumn(3).width = 18;
    worksheet.getColumn(4).width = 15;
  }

  await downloadWorkbook(workbook, filename);
}
