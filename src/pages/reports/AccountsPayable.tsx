/**
 * Accounts Payable Aging Report Page
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
  generateAPAgingReport,
  getTopVendors,
  getOverduePercentage,
} from '@/lib/reports/accountsPayable';
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

export default function AccountsPayable() {
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

  // Fetch accounts to find AP account IDs
  const {
    data: accountsData,
    isLoading: isLoadingAccounts,
  } = useQuery({
    queryKey: ['accounts', role],
    queryFn: () => getAccounts(role || 'accountant'),
  });

  // Get AP account IDs (typically code starts with '2' for liabilities, and contains 'payable')
  const apAccountIds = useMemo(() => {
    const accounts = accountsData?.items ?? [];
    if (!accounts || accounts.length === 0) return [];
    return accounts
      .filter(acc =>
        acc.name.toLowerCase().includes('payable') ||
        (acc.code.startsWith('2') && acc.name.toLowerCase().includes('accounts payable'))
      )
      .map(acc => acc.id);
  }, [accountsData]);

  // Fetch entities (vendors/suppliers)
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
    queryKey: ['ledger-ap', role, asOfDate.toISOString().split('T')[0], apAccountIds],
    queryFn: () =>
      getLedger(
        {
          end: asOfDate.toISOString().split('T')[0],
          limit: 10000,
        },
        role || 'accountant'
      ),
    enabled: apAccountIds.length > 0,
  });

  // Fetch comparison period ledger entries
  const {
    data: comparisonLedger,
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['ledger-ap', role, comparisonDate?.toISOString().split('T')[0], apAccountIds],
    queryFn: () =>
      getLedger(
        {
          end: comparisonDate!.toISOString().split('T')[0],
          limit: 10000,
        },
        role || 'accountant'
      ),
    enabled: !!comparisonDate && apAccountIds.length > 0,
  });

  // Generate AP aging data
  const apAgingData = useMemo(() => {
    const entities = entitiesData?.items ?? [];
    if (!currentLedger?.items || !entities || entities.length === 0 || apAccountIds.length === 0) return null;

    return generateAPAgingReport(
      currentLedger.items,
      entities,
      apAccountIds,
      asOfDate.toISOString().split('T')[0],
      comparisonLedger?.items,
      comparisonDate?.toISOString().split('T')[0]
    );
  }, [currentLedger, comparisonLedger, entitiesData, apAccountIds, asOfDate, comparisonDate]);

  // Prepare pie chart data (aging buckets)
  const pieChartData = useMemo(() => {
    if (!apAgingData) return [];

    return [
      { name: 'Current (0-30)', value: apAgingData.summary.totalCurrent },
      { name: '31-60 days', value: apAgingData.summary.totalDays30 },
      { name: '61-90 days', value: apAgingData.summary.totalDays60 },
      { name: '90+ days', value: apAgingData.summary.totalDays90 },
    ].filter(item => item.value > 0);
  }, [apAgingData]);

  // Prepare bar chart data (top 10 vendors)
  const barChartData = useMemo(() => {
    if (!apAgingData) return [];

    return getTopVendors(apAgingData, 10).map(vendor => ({
      name: vendor.entityName.length > 20
        ? vendor.entityName.substring(0, 20) + '...'
        : vendor.entityName,
      amount: vendor.total,
    }));
  }, [apAgingData]);

  // Calculate overdue percentage
  const overduePercentage = useMemo(() => {
    if (!apAgingData) return 0;
    return getOverduePercentage(apAgingData);
  }, [apAgingData]);

  // Handle export
  const handleExport = async () => {
    if (!apAgingData) return;

    setIsExporting(true);
    try {
      await exportAgingReport(
        {
          type: 'AP',
          asOfDate: apAgingData.asOfDate,
          comparisonDate: apAgingData.comparisonDate,
          entities: apAgingData.entities.map(e => ({
            name: e.entityName,
            current: e.current,
            days30: e.days30,
            days60: e.days60,
            days90: e.days90,
            total: e.total,
            comparisonTotal: e.comparisonTotal,
          })),
          summary: apAgingData.summary,
          dpo: apAgingData.dpo,
        }
      );
      toast({
        title: 'Export successful',
        description: 'AP aging report has been downloaded',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export AP aging report',
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
        <span className="ml-2">Loading AP aging report...</span>
      </div>
    );
  }

  // Error state
  if (currentError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load AP aging data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // No AP accounts state
  if (apAccountIds.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No Accounts Payable accounts found. Please add an AP account in the Chart of Accounts.
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!apAgingData || apAgingData.entities.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No accounts payable data available for the selected date.
        </AlertDescription>
      </Alert>
    );
  }

  const showComparison = !!comparisonDate && comparisonType !== 'none';

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Accounts Payable Aging"
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
          title="Total Payables"
          value={apAgingData.summary.grandTotal}
          trend={
            showComparison && apAgingData.summary.comparisonGrandTotal !== undefined
              ? calculateTrend(
                  apAgingData.summary.grandTotal,
                  apAgingData.summary.comparisonGrandTotal
                )
              : undefined
          }
          trendValue={
            showComparison && apAgingData.summary.comparisonGrandTotal !== undefined
              ? apAgingData.summary.grandTotal - apAgingData.summary.comparisonGrandTotal
              : undefined
          }
        />

        <ReportCard
          title="Current (0-30 days)"
          value={apAgingData.summary.totalCurrent}
          description={`${((apAgingData.summary.totalCurrent / apAgingData.summary.grandTotal) * 100).toFixed(1)}% of total`}
        />

        <ReportCard
          title="Overdue (>30 days)"
          value={apAgingData.summary.totalDays30 + apAgingData.summary.totalDays60 + apAgingData.summary.totalDays90}
          description={`${overduePercentage.toFixed(1)}% of total`}
        />

        <ReportCard
          title="Days Payable Outstanding"
          value={apAgingData.dpo || 0}
          description="Average payment period"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart - Aging Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>AP Aging Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => `${entry.name}: ${((entry.value / apAgingData.summary.grandTotal) * 100).toFixed(1)}%`}
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

        {/* Bar Chart - Top 10 Vendors */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Vendors by Outstanding Balance</CardTitle>
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
          <CardTitle>Vendor Aging Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
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
                {apAgingData.entities.map(entity => {
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
                    {formatReportCurrency(apAgingData.summary.totalCurrent)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(apAgingData.summary.totalDays30)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(apAgingData.summary.totalDays60)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(apAgingData.summary.totalDays90)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatReportCurrency(apAgingData.summary.grandTotal)}
                  </TableCell>
                  {showComparison && (
                    <>
                      <TableCell className="text-right font-mono">
                        {apAgingData.summary.comparisonGrandTotal !== undefined
                          ? formatReportCurrency(apAgingData.summary.comparisonGrandTotal)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {apAgingData.summary.comparisonGrandTotal !== undefined
                          ? formatReportCurrency(
                              apAgingData.summary.grandTotal - apAgingData.summary.comparisonGrandTotal
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
