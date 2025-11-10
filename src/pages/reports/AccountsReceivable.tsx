/**
 * Accounts Receivable Aging Report Page
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { ReportCard } from '@/components/reports/ReportCard';
import { SingleDatePicker } from '@/components/reports/DateRangePicker';
import { getLedger, getAccounts, getEntities } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import {
  generateARAgingReport,
  getTopCustomers,
  getOverduePercentage,
} from '@/lib/reports/accountsReceivable';
import { exportAgingReport } from '@/lib/reports/excelExport';
import { calculateTrend, formatReportCurrency, type ComparisonType, getComparisonPeriod } from '@/lib/reports/utils';
import { useToast } from '@/hooks/use-toast';
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

const COLORS = ['#4caf50', '#ff9800', '#ff6b6b', '#9c27b0'];

export default function AccountsReceivable() {
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

  // Fetch accounts to find AR account IDs
  const {
    data: accountsData,
    isLoading: isLoadingAccounts,
  } = useQuery({
    queryKey: ['accounts', role],
    queryFn: () => getAccounts(role || 'accountant'),
  });

  // Get AR account IDs (typically code starts with '1' for assets, and contains 'receivable')
  const arAccountIds = useMemo(() => {
    const accounts = accountsData?.items ?? [];
    if (!accounts || accounts.length === 0) return [];
    return accounts
      .filter(acc =>
        acc.name.toLowerCase().includes('receivable') ||
        (acc.code.startsWith('1') && acc.name.toLowerCase().includes('accounts receivable'))
      )
      .map(acc => acc.id);
  }, [accountsData]);

  // Fetch entities (customers)
  const {
    data: entitiesData,
    isLoading: isLoadingEntities,
  } = useQuery({
    queryKey: ['entities', role],
    queryFn: () => getEntities(role || 'accountant'),
  });

  // Fetch current period ledger entries
  const {
    data: currentLedger,
    isLoading: isLoadingCurrent,
    error: currentError,
  } = useQuery({
    queryKey: ['ledger-ar', role, asOfDate.toISOString().split('T')[0], arAccountIds],
    queryFn: () =>
      getLedger(
        {
          end: asOfDate.toISOString().split('T')[0],
          limit: 10000,
        },
        role || 'accountant'
      ),
    enabled: arAccountIds.length > 0,
  });

  // Fetch comparison period ledger entries
  const {
    data: comparisonLedger,
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['ledger-ar', role, comparisonDate?.toISOString().split('T')[0], arAccountIds],
    queryFn: () =>
      getLedger(
        {
          end: comparisonDate!.toISOString().split('T')[0],
          limit: 10000,
        },
        role || 'accountant'
      ),
    enabled: !!comparisonDate && arAccountIds.length > 0,
  });

  // Generate AR aging data
  const arAgingData = useMemo(() => {
    const entities = entitiesData?.items ?? [];
    if (!currentLedger?.items || !entities || entities.length === 0 || arAccountIds.length === 0) return null;

    return generateARAgingReport(
      currentLedger.items,
      entities,
      arAccountIds,
      asOfDate.toISOString().split('T')[0],
      comparisonLedger?.items,
      comparisonDate?.toISOString().split('T')[0]
    );
  }, [currentLedger, comparisonLedger, entitiesData, arAccountIds, asOfDate, comparisonDate]);

  // Prepare pie chart data (aging buckets)
  const pieChartData = useMemo(() => {
    if (!arAgingData) return [];

    return [
      { name: 'Current (0-30)', value: arAgingData.summary.totalCurrent },
      { name: '31-60 days', value: arAgingData.summary.totalDays30 },
      { name: '61-90 days', value: arAgingData.summary.totalDays60 },
      { name: '90+ days', value: arAgingData.summary.totalDays90 },
    ].filter(item => item.value > 0);
  }, [arAgingData]);

  // Prepare bar chart data (top 10 customers)
  const barChartData = useMemo(() => {
    if (!arAgingData) return [];

    return getTopCustomers(arAgingData, 10).map(customer => ({
      name: customer.entityName.length > 20
        ? customer.entityName.substring(0, 20) + '...'
        : customer.entityName,
      amount: customer.total,
    }));
  }, [arAgingData]);

  // Calculate overdue percentage
  const overduePercentage = useMemo(() => {
    if (!arAgingData) return 0;
    return getOverduePercentage(arAgingData);
  }, [arAgingData]);

  // Handle export
  const handleExport = async () => {
    if (!arAgingData) return;

    setIsExporting(true);
    try {
      await exportAgingReport(
        {
          type: 'AR',
          asOfDate: arAgingData.asOfDate,
          comparisonDate: arAgingData.comparisonDate,
          entities: arAgingData.entities.map(e => ({
            name: e.entityName,
            current: e.current,
            days30: e.days30,
            days60: e.days60,
            days90: e.days90,
            total: e.total,
            comparisonTotal: e.comparisonTotal,
          })),
          summary: arAgingData.summary,
          dso: arAgingData.dso,
        }
      );
      toast({
        title: 'Export successful',
        description: 'AR aging report has been downloaded',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export AR aging report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoadingAccounts || isLoadingEntities || isLoadingCurrent) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading AR aging report...</span>
      </div>
    );
  }

  // Error state
  if (currentError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load AR aging data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // No AR accounts state
  if (arAccountIds.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No Accounts Receivable accounts found. Please add an AR account in the Chart of Accounts.
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!arAgingData || arAgingData.entities.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No accounts receivable data available for the selected date.
        </AlertDescription>
      </Alert>
    );
  }

  const showComparison = !!comparisonDate && comparisonType !== 'none';

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Accounts Receivable Aging"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ReportCard
          title="Total Receivables"
          value={arAgingData.summary.grandTotal}
          trend={
            showComparison && arAgingData.summary.comparisonGrandTotal !== undefined
              ? calculateTrend(
                  arAgingData.summary.grandTotal,
                  arAgingData.summary.comparisonGrandTotal
                )
              : undefined
          }
          trendValue={
            showComparison && arAgingData.summary.comparisonGrandTotal !== undefined
              ? arAgingData.summary.grandTotal - arAgingData.summary.comparisonGrandTotal
              : undefined
          }
        />

        <ReportCard
          title="Current (0-30 days)"
          value={arAgingData.summary.totalCurrent}
          description={`${((arAgingData.summary.totalCurrent / arAgingData.summary.grandTotal) * 100).toFixed(1)}% of total`}
        />

        <ReportCard
          title="Overdue (>30 days)"
          value={arAgingData.summary.totalDays30 + arAgingData.summary.totalDays60 + arAgingData.summary.totalDays90}
          description={`${overduePercentage.toFixed(1)}% of total`}
        />

        <ReportCard
          title="Days Sales Outstanding"
          value={arAgingData.dso || 0}
          description="Average collection period"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart - Aging Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>AR Aging Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => `${entry.name}: ${((entry.value / arAgingData.summary.grandTotal) * 100).toFixed(1)}%`}
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

        {/* Bar Chart - Top 10 Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Customers by Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: 'ZAR',
                    }).format(value)
                  }
                />
                <Legend />
                <Bar dataKey="amount" fill="#0077c8" name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Aging Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">31-60</TableHead>
                  <TableHead className="text-right">61-90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {showComparison && (
                    <>
                      <TableHead className="text-right">Previous</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {arAgingData.entities.map(entity => {
                  const change = showComparison && entity.comparisonTotal !== undefined
                    ? entity.total - entity.comparisonTotal
                    : undefined;

                  return (
                    <TableRow key={entity.entityId}>
                      <TableCell className="font-medium">{entity.entityName}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatReportCurrency(entity.current)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatReportCurrency(entity.days30)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatReportCurrency(entity.days60)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatReportCurrency(entity.days90)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatReportCurrency(entity.total)}
                      </TableCell>
                      {showComparison && (
                        <>
                          <TableCell className="text-right font-mono">
                            {entity.comparisonTotal !== undefined
                              ? formatReportCurrency(entity.comparisonTotal)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {change !== undefined ? formatReportCurrency(change) : '-'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}

                {/* Total Row */}
                <TableRow className="font-bold bg-muted">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(arAgingData.summary.totalCurrent)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(arAgingData.summary.totalDays30)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(arAgingData.summary.totalDays60)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(arAgingData.summary.totalDays90)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(arAgingData.summary.grandTotal)}
                  </TableCell>
                  {showComparison && (
                    <>
                      <TableCell className="text-right font-mono">
                        {arAgingData.summary.comparisonGrandTotal !== undefined
                          ? formatReportCurrency(arAgingData.summary.comparisonGrandTotal)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {arAgingData.summary.comparisonGrandTotal !== undefined
                          ? formatReportCurrency(
                              arAgingData.summary.grandTotal - arAgingData.summary.comparisonGrandTotal
                            )
                          : '-'}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
