/**
 * Balance Sheet Report Page
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, subYears } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { ReportCard } from '@/components/reports/ReportCard';
import { ComparisonTable, type ComparisonTableRow } from '@/components/reports/ComparisonTable';
import { SingleDatePicker } from '@/components/reports/DateRangePicker';
import { getTrialBalance } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { generateBalanceSheet, validateAccountingEquation } from '@/lib/reports/balanceSheet';
import { exportBalanceSheet } from '@/lib/reports/excelExport';
import { calculateTrend, type ComparisonType, getComparisonPeriod } from '@/lib/reports/utils';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function BalanceSheet() {
  const { toast } = useToast();
  const role = getPrimaryRole();

  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [comparisonType, setComparisonType] = useState<ComparisonType | 'none'>('previous-month');
  const [customComparisonDate, setCustomComparisonDate] = useState<Date | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  // Calculate comparison date
  const comparisonDate = useMemo(() => {
    if (comparisonType === 'none') return undefined;
    if (comparisonType === 'custom') return customComparisonDate;
    return getComparisonPeriod(asOfDate, comparisonType);
  }, [asOfDate, comparisonType, customComparisonDate]);

  // Fetch current trial balance
  const {
    data: currentData,
    isLoading: isLoadingCurrent,
    error: currentError,
  } = useQuery({
    queryKey: ['trial-balance', role, asOfDate.toISOString().split('T')[0]],
    queryFn: () =>
      getTrialBalance({ asOfDate: asOfDate.toISOString().split('T')[0] }, role || 'accountant'),
  });

  // Fetch comparison trial balance
  const {
    data: comparisonData,
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['trial-balance', role, comparisonDate?.toISOString().split('T')[0]],
    queryFn: () =>
      getTrialBalance(
        { asOfDate: comparisonDate!.toISOString().split('T')[0] },
        role || 'accountant'
      ),
    enabled: !!comparisonDate,
  });

  // Generate balance sheet data
  const balanceSheetData = useMemo(() => {
    if (!currentData?.items) return null;

    return generateBalanceSheet(
      currentData.items,
      asOfDate.toISOString().split('T')[0],
      comparisonData?.items,
      comparisonDate?.toISOString().split('T')[0]
    );
  }, [currentData, comparisonData, asOfDate, comparisonDate]);

  // Validate accounting equation
  const validation = useMemo(() => {
    if (!balanceSheetData) return null;
    return validateAccountingEquation(balanceSheetData);
  }, [balanceSheetData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!balanceSheetData) return [];

    const current = [
      {
        name: 'Assets',
        amount: balanceSheetData.totals.totalAssets,
      },
      {
        name: 'Liabilities',
        amount: balanceSheetData.totals.totalLiabilities,
      },
      {
        name: 'Equity',
        amount: balanceSheetData.totals.totalEquity,
      },
    ];

    if (comparisonDate && balanceSheetData.comparisonDate) {
      return [
        {
          name: 'Assets',
          Current: balanceSheetData.totals.totalAssets,
          Previous: balanceSheetData.totals.comparisonTotalAssets || 0,
        },
        {
          name: 'Liabilities',
          Current: balanceSheetData.totals.totalLiabilities,
          Previous: balanceSheetData.totals.comparisonTotalLiabilities || 0,
        },
        {
          name: 'Equity',
          Current: balanceSheetData.totals.totalEquity,
          Previous: balanceSheetData.totals.comparisonTotalEquity || 0,
        },
      ];
    }

    return current.map(item => ({ name: item.name, Amount: item.amount }));
  }, [balanceSheetData, comparisonDate]);

  // Prepare table rows
  const tableRows = useMemo((): ComparisonTableRow[] => {
    if (!balanceSheetData) return [];

    const rows: ComparisonTableRow[] = [];

    // Assets section
    rows.push({
      id: 'assets-header',
      label: 'ASSETS',
      current: 0,
      isSubtotal: true,
    });

    balanceSheetData.assets.forEach(account => {
      rows.push({
        id: `asset-${account.id}`,
        label: `${account.code} - ${account.name}`,
        current: account.current,
        comparison: account.comparison,
        indent: 1,
      });
    });

    rows.push({
      id: 'total-assets',
      label: 'Total Assets',
      current: balanceSheetData.totals.totalAssets,
      comparison: balanceSheetData.totals.comparisonTotalAssets,
      isTotal: true,
    });

    // Liabilities section
    rows.push({
      id: 'liabilities-header',
      label: 'LIABILITIES',
      current: 0,
      isSubtotal: true,
    });

    balanceSheetData.liabilities.forEach(account => {
      rows.push({
        id: `liability-${account.id}`,
        label: `${account.code} - ${account.name}`,
        current: account.current,
        comparison: account.comparison,
        indent: 1,
      });
    });

    rows.push({
      id: 'total-liabilities',
      label: 'Total Liabilities',
      current: balanceSheetData.totals.totalLiabilities,
      comparison: balanceSheetData.totals.comparisonTotalLiabilities,
      isTotal: true,
    });

    // Equity section
    rows.push({
      id: 'equity-header',
      label: 'EQUITY',
      current: 0,
      isSubtotal: true,
    });

    balanceSheetData.equity.forEach(account => {
      rows.push({
        id: `equity-${account.id}`,
        label: `${account.code} - ${account.name}`,
        current: account.current,
        comparison: account.comparison,
        indent: 1,
      });
    });

    rows.push({
      id: 'total-equity',
      label: 'Total Equity',
      current: balanceSheetData.totals.totalEquity,
      comparison: balanceSheetData.totals.comparisonTotalEquity,
      isTotal: true,
    });

    return rows;
  }, [balanceSheetData]);

  // Handle export
  const handleExport = async () => {
    if (!balanceSheetData) return;

    setIsExporting(true);
    try {
      await exportBalanceSheet(balanceSheetData);
      toast({
        title: 'Export successful',
        description: 'Balance sheet has been downloaded',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export balance sheet',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoadingCurrent) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading balance sheet...</span>
      </div>
    );
  }

  // Error state
  if (currentError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load balance sheet data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!balanceSheetData) {
    return (
      <Alert>
        <AlertDescription>
          No balance sheet data available for the selected date.
        </AlertDescription>
      </Alert>
    );
  }

  const showComparison = !!comparisonDate && comparisonType !== 'none';

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Balance Sheet"
        subtitle={`As of ${format(asOfDate, 'MMMM dd, yyyy')}`}
        onExport={handleExport}
        isExporting={isExporting}
      >
        <SingleDatePicker
          value={asOfDate}
          onChange={date => date && setAsOfDate(date)}
          placeholder="Select as of date"
          className="w-[200px]"
        />

        <Select value={comparisonType} onValueChange={value => setComparisonType(value as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Comparison" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Comparison</SelectItem>
            <SelectItem value="previous-month">Previous Month</SelectItem>
            <SelectItem value="previous-quarter">Previous Quarter</SelectItem>
            <SelectItem value="previous-year">Previous Year</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
          </SelectContent>
        </Select>

        {comparisonType === 'custom' && (
          <SingleDatePicker
            value={customComparisonDate}
            onChange={setCustomComparisonDate}
            placeholder="Select comparison date"
            className="w-[200px]"
          />
        )}
      </ReportHeader>

      {/* Validation Alert */}
      {validation && !validation.isBalanced && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Balance sheet is out of balance by{' '}
            {new Intl.NumberFormat('en-ZA', {
              style: 'currency',
              currency: 'ZAR',
            }).format(Math.abs(validation.difference))}
            . Assets should equal Liabilities + Equity.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportCard
          title="Total Assets"
          value={balanceSheetData.totals.totalAssets}
          trend={
            showComparison && balanceSheetData.totals.comparisonTotalAssets !== undefined
              ? calculateTrend(
                  balanceSheetData.totals.totalAssets,
                  balanceSheetData.totals.comparisonTotalAssets
                )
              : undefined
          }
          trendValue={
            showComparison && balanceSheetData.totals.comparisonTotalAssets !== undefined
              ? balanceSheetData.totals.totalAssets -
                balanceSheetData.totals.comparisonTotalAssets
              : undefined
          }
        />

        <ReportCard
          title="Total Liabilities"
          value={balanceSheetData.totals.totalLiabilities}
          trend={
            showComparison && balanceSheetData.totals.comparisonTotalLiabilities !== undefined
              ? calculateTrend(
                  balanceSheetData.totals.totalLiabilities,
                  balanceSheetData.totals.comparisonTotalLiabilities
                )
              : undefined
          }
          trendValue={
            showComparison && balanceSheetData.totals.comparisonTotalLiabilities !== undefined
              ? balanceSheetData.totals.totalLiabilities -
                balanceSheetData.totals.comparisonTotalLiabilities
              : undefined
          }
        />

        <ReportCard
          title="Total Equity"
          value={balanceSheetData.totals.totalEquity}
          trend={
            showComparison && balanceSheetData.totals.comparisonTotalEquity !== undefined
              ? calculateTrend(
                  balanceSheetData.totals.totalEquity,
                  balanceSheetData.totals.comparisonTotalEquity
                )
              : undefined
          }
          trendValue={
            showComparison && balanceSheetData.totals.comparisonTotalEquity !== undefined
              ? balanceSheetData.totals.totalEquity - balanceSheetData.totals.comparisonTotalEquity
              : undefined
          }
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat('en-ZA', {
                    style: 'currency',
                    currency: 'ZAR',
                  }).format(value)
                }
              />
              <Legend />
              {showComparison ? (
                <>
                  <Bar dataKey="Current" fill="#0077c8" />
                  <Bar dataKey="Previous" fill="#4caf50" />
                </>
              ) : (
                <Bar dataKey="Amount" fill="#0077c8" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Balance Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonTable
            rows={tableRows}
            currentLabel={format(asOfDate, 'MMM dd, yyyy')}
            comparisonLabel={comparisonDate ? format(comparisonDate, 'MMM dd, yyyy') : 'Previous'}
            showComparison={showComparison}
          />
        </CardContent>
      </Card>
    </div>
  );
}
