/**
 * Expense Report Page
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
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
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { getTrialBalance, getLedger } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { generateExpenseReport, getTopExpenses } from '@/lib/reports/expenses';
import { exportExpenseReport } from '@/lib/reports/excelExport';
import { calculateTrend } from '@/lib/reports/utils';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0077c8', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#ffeb3b', '#795548'];

export default function ExpenseReport() {
  const { toast } = useToast();
  const role = getPrimaryRole();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });
  const [showComparison, setShowComparison] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate comparison period (previous month)
  const comparisonDateRange = useMemo(() => {
    if (!showComparison || !dateRange.from || !dateRange.to) return null;

    const monthsDiff = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const from = subMonths(dateRange.from, monthsDiff);
    const to = subMonths(dateRange.to, monthsDiff);

    return { from, to };
  }, [dateRange, showComparison]);

  // Fetch current period trial balance
  const {
    data: currentTrialBalance,
    isLoading: isLoadingCurrent,
    error: currentError,
  } = useQuery({
    queryKey: ['trial-balance', role, dateRange.to?.toISOString().split('T')[0]],
    queryFn: () =>
      getTrialBalance(
        { asOfDate: dateRange.to!.toISOString().split('T')[0] },
        role || 'accountant'
      ),
    enabled: !!dateRange.to,
  });

  // Fetch comparison period trial balance
  const {
    data: comparisonTrialBalance,
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['trial-balance', role, comparisonDateRange?.to?.toISOString().split('T')[0]],
    queryFn: () =>
      getTrialBalance(
        { asOfDate: comparisonDateRange!.to!.toISOString().split('T')[0] },
        role || 'accountant'
      ),
    enabled: !!comparisonDateRange?.to && showComparison,
  });

  // Fetch ledger entries for trend (last 12 months from end date)
  const {
    data: ledgerData,
    isLoading: isLoadingLedger,
  } = useQuery({
    queryKey: [
      'ledger',
      role,
      startOfYear(subMonths(dateRange.to || today, 11)).toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0],
    ],
    queryFn: () =>
      getLedger(
        {
          start: startOfYear(subMonths(dateRange.to || today, 11)).toISOString().split('T')[0],
          end: dateRange.to!.toISOString().split('T')[0],
          limit: 10000,
        },
        role || 'accountant'
      ),
    enabled: !!dateRange.to,
  });

  // Generate expense report data
  const expenseData = useMemo(() => {
    if (!currentTrialBalance?.items || !dateRange.from || !dateRange.to) return null;

    // Filter ledger entries for expense accounts only
    const expenseLedger = ledgerData?.items?.filter(entry => {
      const account = currentTrialBalance.items.find(acc => acc.account_id === entry.account_id);
      return account?.type === 'Expense';
    }) || [];

    return generateExpenseReport(
      currentTrialBalance.items,
      expenseLedger,
      dateRange.from.toISOString().split('T')[0],
      dateRange.to.toISOString().split('T')[0],
      showComparison ? comparisonTrialBalance?.items : undefined,
      comparisonDateRange?.from?.toISOString().split('T')[0],
      comparisonDateRange?.to?.toISOString().split('T')[0]
    );
  }, [currentTrialBalance, comparisonTrialBalance, ledgerData, dateRange, comparisonDateRange, showComparison]);

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    if (!expenseData) return [];

    return expenseData.categories.map(cat => ({
      name: cat.category,
      value: cat.current,
    }));
  }, [expenseData]);

  // Prepare bar chart data for monthly trend
  const barChartData = useMemo(() => {
    if (!expenseData) return [];

    return expenseData.monthlyTrend.map(item => ({
      month: format(item.period, 'MMM yyyy'),
      amount: item.amount,
    }));
  }, [expenseData]);

  // Prepare table rows
  const tableRows = useMemo((): ComparisonTableRow[] => {
    if (!expenseData) return [];

    const rows: ComparisonTableRow[] = [];

    expenseData.categories.forEach(category => {
      rows.push({
        id: category.category,
        label: category.category,
        current: category.current,
        comparison: category.comparison,
        isSubtotal: true,
      });

      // Add individual accounts under category
      category.accounts.forEach(account => {
        rows.push({
          id: account.id,
          label: `${account.code} - ${account.name}`,
          current: account.amount,
          indent: 1,
        });
      });
    });

    // Add total row
    rows.push({
      id: 'total',
      label: 'Total Expenses',
      current: expenseData.totals.totalExpenses,
      comparison: expenseData.totals.comparisonTotalExpenses,
      isTotal: true,
    });

    return rows;
  }, [expenseData]);

  // Get top 5 expenses
  const topExpenses = useMemo(() => {
    if (!expenseData) return [];
    return getTopExpenses(expenseData, 5);
  }, [expenseData]);

  // Handle export
  const handleExport = async () => {
    if (!expenseData) return;

    setIsExporting(true);
    try {
      await exportExpenseReport(expenseData);
      toast({
        title: 'Export successful',
        description: 'Expense report has been downloaded',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export expense report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoadingCurrent || isLoadingLedger) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading expense report...</span>
      </div>
    );
  }

  // Error state
  if (currentError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load expense report data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!expenseData) {
    return (
      <Alert>
        <AlertDescription>
          No expense data available for the selected date range.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Expense Report"
        subtitle={
          dateRange.from && dateRange.to
            ? `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
            : undefined
        }
        onExport={handleExport}
        isExporting={isExporting}
      >
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          className="w-[300px]"
        />

        <Select
          value={showComparison ? 'yes' : 'no'}
          onValueChange={value => setShowComparison(value === 'yes')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Comparison" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Show Comparison</SelectItem>
            <SelectItem value="no">No Comparison</SelectItem>
          </SelectContent>
        </Select>
      </ReportHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportCard
          title="Total Expenses"
          value={expenseData.totals.totalExpenses}
          trend={
            showComparison && expenseData.totals.comparisonTotalExpenses !== undefined
              ? calculateTrend(
                  expenseData.totals.totalExpenses,
                  expenseData.totals.comparisonTotalExpenses
                )
              : undefined
          }
          trendValue={
            showComparison && expenseData.totals.comparisonTotalExpenses !== undefined
              ? expenseData.totals.totalExpenses - expenseData.totals.comparisonTotalExpenses
              : undefined
          }
        />

        <ReportCard
          title="Number of Categories"
          value={expenseData.categories.length}
          description="Active expense categories"
        />

        <ReportCard
          title="Largest Category"
          value={topExpenses[0]?.current || 0}
          description={topExpenses[0]?.category || 'N/A'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart - Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => `${entry.name}: ${((entry.value / expenseData.totals.totalExpenses) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: 'ZAR',
                    }).format(value)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Expense Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
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
                <Bar dataKey="amount" fill="#0077c8" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Expense Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topExpenses.map((category, index) => (
              <div key={category.category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{category.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">
                    {new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: 'ZAR',
                    }).format(category.current)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {((category.current / expenseData.totals.totalExpenses) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Expense Report</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonTable
            rows={tableRows}
            currentLabel={dateRange.to ? format(dateRange.to, 'MMM dd, yyyy') : 'Current'}
            comparisonLabel={
              comparisonDateRange?.to ? format(comparisonDateRange.to, 'MMM dd, yyyy') : 'Previous'
            }
            showComparison={showComparison}
          />
        </CardContent>
      </Card>
    </div>
  );
}
