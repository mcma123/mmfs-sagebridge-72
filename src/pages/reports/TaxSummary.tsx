/**
 * Tax Summary Report Page
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
import { Badge } from '@/components/ui/badge';
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
import { getTaxReports, getTaxLiabilities } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { generateTaxSummary } from '@/lib/reports/taxSummary';
import { exportTaxSummary } from '@/lib/reports/excelExport';
import { calculateTrend, formatReportCurrency } from '@/lib/reports/utils';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0077c8', '#4caf50', '#ff9800', '#f44336'];

const STATUS_COLORS = {
  draft: 'bg-amber-500',
  reviewed: 'bg-blue-500',
  submitted: 'bg-green-500',
};

export default function TaxSummary() {
  const { toast } = useToast();
  const role = getPrimaryRole();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showComparison, setShowComparison] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const comparisonYear = showComparison ? selectedYear - 1 : undefined;

  // Fetch current year tax reports
  const {
    data: currentReports,
    isLoading: isLoadingCurrent,
    error: currentError,
  } = useQuery({
    queryKey: ['tax-reports', role, selectedYear],
    queryFn: () => getTaxReports({ year: selectedYear }, role || 'accountant'),
  });

  // Fetch comparison year tax reports
  const {
    data: comparisonReports,
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['tax-reports', role, comparisonYear],
    queryFn: () => getTaxReports({ year: comparisonYear! }, role || 'accountant'),
    enabled: !!comparisonYear,
  });

  // Fetch current tax liabilities
  const {
    data: liabilities,
    isLoading: isLoadingLiabilities,
  } = useQuery({
    queryKey: ['tax-liabilities', role],
    queryFn: () => getTaxLiabilities(role || 'accountant'),
  });

  // Generate tax summary data
  const taxSummaryData = useMemo(() => {
    if (!currentReports || !liabilities) return null;

    return generateTaxSummary(
      currentReports.items || [],
      liabilities.items || [],
      selectedYear,
      showComparison ? (comparisonReports?.items || []) : undefined,
      comparisonYear
    );
  }, [currentReports, comparisonReports, liabilities, selectedYear, showComparison, comparisonYear]);

  // Prepare quarterly VAT chart data
  const quarterlyChartData = useMemo(() => {
    if (!taxSummaryData) return [];

    return taxSummaryData.quarterlyVAT.map(q => ({
      quarter: q.quarter,
      [selectedYear]: q.current,
      ...(showComparison && comparisonYear ? { [comparisonYear]: q.comparison || 0 } : {}),
    }));
  }, [taxSummaryData, selectedYear, comparisonYear, showComparison]);

  // Prepare pie chart data (current liabilities breakdown)
  const pieChartData = useMemo(() => {
    if (!taxSummaryData) return [];

    return taxSummaryData.currentLiabilities
      .filter(l => l.amount > 0)
      .map(l => ({
        name: l.account.split(' - ')[1] || l.account,
        value: l.amount,
      }));
  }, [taxSummaryData]);

  // Handle export
  const handleExport = async () => {
    if (!taxSummaryData) return;

    setIsExporting(true);
    try {
      await exportTaxSummary(taxSummaryData);
      toast({
        title: 'Export successful',
        description: 'Tax summary has been downloaded',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export tax summary',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoadingCurrent || isLoadingLiabilities) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading tax summary...</span>
      </div>
    );
  }

  // Error state
  if (currentError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load tax summary data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!taxSummaryData) {
    return (
      <Alert>
        <AlertDescription>
          No tax data available for the selected year.
        </AlertDescription>
      </Alert>
    );
  }

  // Year options (current year and 4 previous years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Tax Summary"
        subtitle={`Tax year ${selectedYear}`}
        onExport={handleExport}
        isExporting={isExporting}
      >
        <Select
          value={selectedYear.toString()}
          onValueChange={value => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          title="Total VAT (Annual)"
          value={taxSummaryData.totals.totalVAT}
          trend={
            showComparison && taxSummaryData.totals.comparisonTotalVAT !== undefined
              ? calculateTrend(
                  taxSummaryData.totals.totalVAT,
                  taxSummaryData.totals.comparisonTotalVAT
                )
              : undefined
          }
          trendValue={
            showComparison && taxSummaryData.totals.comparisonTotalVAT !== undefined
              ? taxSummaryData.totals.totalVAT - taxSummaryData.totals.comparisonTotalVAT
              : undefined
          }
        />

        <ReportCard
          title="Current Tax Liabilities"
          value={taxSummaryData.totals.totalLiabilities}
          description="Outstanding tax amounts"
        />

        <ReportCard
          title="Tax Returns Filed"
          value={taxSummaryData.taxReturns.filter(r => r.status === 'submitted').length}
          description={`Out of ${taxSummaryData.taxReturns.length} total`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart - Quarterly VAT */}
        <Card>
          <CardHeader>
            <CardTitle>Quarterly VAT Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quarterlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
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
                <Bar dataKey={selectedYear} fill="#0077c8" name={selectedYear.toString()} />
                {showComparison && comparisonYear && (
                  <Bar dataKey={comparisonYear} fill="#4caf50" name={comparisonYear.toString()} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Tax Liabilities Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Current Tax Liabilities Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={entry => entry.name}
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
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No current tax liabilities
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Liabilities Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Tax Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          {taxSummaryData.currentLiabilities.length > 0 ? (
            <div className="space-y-3">
              {taxSummaryData.currentLiabilities.map((liability, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">{liability.account}</span>
                  <span className="font-mono">{formatReportCurrency(liability.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold">
                <span>Total Liabilities</span>
                <span className="font-mono">
                  {formatReportCurrency(taxSummaryData.totals.totalLiabilities)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No current tax liabilities</p>
          )}
        </CardContent>
      </Card>

      {/* Tax Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Returns for {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {taxSummaryData.taxReturns.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxSummaryData.taxReturns.map((taxReturn, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{taxReturn.type}</TableCell>
                      <TableCell>{taxReturn.period}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatReportCurrency(taxReturn.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLORS[taxReturn.status as keyof typeof STATUS_COLORS] || ''
                          }
                        >
                          {taxReturn.status.charAt(0).toUpperCase() + taxReturn.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(taxReturn.dueDate), 'MMM dd, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No tax returns for this year</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
