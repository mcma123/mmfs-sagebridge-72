/**
 * Cash Flow Statement Report
 * Displays operating, investing, and financing activities with cash flow analysis
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { ReportCard } from '@/components/reports/ReportCard';
import { SingleDatePicker } from '@/components/reports/DateRangePicker';
import { generateCashFlowStatement, type CashFlowData } from '@/lib/reports/cashFlow';
import { exportCashFlow } from '@/lib/reports/excelExport';
import { formatReportCurrency, calculateTrend, getComparisonPeriod } from '@/lib/reports/utils';
import type { LedgerEntryDTO, AccountDTO } from '@/lib/api/accounting';

const CashFlow: React.FC = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(lastDayOfMonth);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState<'mom' | 'qoq' | 'yoy'>('mom');
  const [isExporting, setIsExporting] = useState(false);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get comparison period dates
  const { startDate: compStartDate, endDate: compEndDate } = showComparison
    ? getComparisonPeriod(startDate, endDate, comparisonPeriod)
    : { startDate: '', endDate: '' };

  // Fetch current period ledger entries
  const { data: currentLedger, isLoading: loadingCurrent } = useQuery<LedgerEntryDTO[]>({
    queryKey: ['ledger', startDateStr, endDateStr],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/v1/accounting/general-ledger?startDate=${startDateStr}&endDate=${endDateStr}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch ledger data');
      return response.json();
    },
  });

  // Fetch comparison period ledger entries
  const { data: comparisonLedger, isLoading: loadingComparison } = useQuery<LedgerEntryDTO[]>({
    queryKey: ['ledger', compStartDate, compEndDate],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/v1/accounting/general-ledger?startDate=${compStartDate}&endDate=${compEndDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch comparison ledger data');
      return response.json();
    },
    enabled: showComparison && !!compStartDate && !!compEndDate,
  });

  // Fetch accounts
  const { data: accounts, isLoading: loadingAccounts } = useQuery<AccountDTO[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/accounting/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  const isLoading = loadingCurrent || loadingAccounts || (showComparison && loadingComparison);

  // Generate cash flow statement
  const cashFlowData: CashFlowData | null = React.useMemo(() => {
    if (!currentLedger || !accounts) return null;
    return generateCashFlowStatement(
      currentLedger,
      accounts,
      startDateStr,
      endDateStr,
      showComparison ? comparisonLedger : undefined,
      showComparison ? compStartDate : undefined,
      showComparison ? compEndDate : undefined
    );
  }, [currentLedger, comparisonLedger, accounts, startDateStr, endDateStr, compStartDate, compEndDate, showComparison]);

  // Handle Excel export
  const handleExport = async () => {
    if (!cashFlowData) return;
    setIsExporting(true);
    try {
      await exportCashFlow(cashFlowData, showComparison);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Prepare waterfall chart data
  const waterfallData = React.useMemo(() => {
    if (!cashFlowData) return [];

    const data = [
      {
        name: 'Beginning Cash',
        value: cashFlowData.totals.beginningCash,
        fill: '#6366f1',
      },
      {
        name: 'Operating Activities',
        value: cashFlowData.totals.netOperating,
        fill: cashFlowData.totals.netOperating >= 0 ? '#10b981' : '#ef4444',
      },
      {
        name: 'Investing Activities',
        value: cashFlowData.totals.netInvesting,
        fill: cashFlowData.totals.netInvesting >= 0 ? '#10b981' : '#ef4444',
      },
      {
        name: 'Financing Activities',
        value: cashFlowData.totals.netFinancing,
        fill: cashFlowData.totals.netFinancing >= 0 ? '#10b981' : '#ef4444',
      },
      {
        name: 'Ending Cash',
        value: cashFlowData.totals.endingCash,
        fill: '#6366f1',
      },
    ];

    return data;
  }, [cashFlowData]);

  // Prepare cash balance trend data
  const trendData = React.useMemo(() => {
    if (!cashFlowData) return [];

    return [
      {
        period: 'Beginning',
        balance: cashFlowData.totals.beginningCash,
      },
      {
        period: 'After Operating',
        balance: cashFlowData.totals.beginningCash + cashFlowData.totals.netOperating,
      },
      {
        period: 'After Investing',
        balance: cashFlowData.totals.beginningCash + cashFlowData.totals.netOperating + cashFlowData.totals.netInvesting,
      },
      {
        period: 'Ending',
        balance: cashFlowData.totals.endingCash,
      },
    ];
  }, [cashFlowData]);

  // Calculate free cash flow (Operating - Investing)
  const freeCashFlow = cashFlowData
    ? cashFlowData.totals.netOperating + cashFlowData.totals.netInvesting
    : 0;

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Cash Flow Statement"
        subtitle={`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`}
        onExport={handleExport}
        isExporting={isExporting}
        showExport={!!cashFlowData}
      >
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <SingleDatePicker
              value={startDate}
              onChange={(date) => date && setStartDate(date)}
              placeholder="Start date"
            />
            <span className="text-muted-foreground">to</span>
            <SingleDatePicker
              value={endDate}
              onChange={(date) => date && setEndDate(date)}
              placeholder="End date"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="comparison"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="comparison" className="text-sm">
              Compare
            </label>
            {showComparison && (
              <select
                value={comparisonPeriod}
                onChange={(e) => setComparisonPeriod(e.target.value as 'mom' | 'qoq' | 'yoy')}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="mom">Month over Month</option>
                <option value="qoq">Quarter over Quarter</option>
                <option value="yoy">Year over Year</option>
              </select>
            )}
          </div>
        </div>
      </ReportHeader>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !cashFlowData ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No data available for the selected period.</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ReportCard
              title="Net Cash Flow"
              value={cashFlowData.totals.netCashFlow}
              trend={
                showComparison && cashFlowData.totals.comparisonNetCashFlow !== undefined
                  ? calculateTrend(
                      cashFlowData.totals.netCashFlow,
                      cashFlowData.totals.comparisonNetCashFlow
                    )
                  : undefined
              }
              trendValue={
                showComparison && cashFlowData.totals.comparisonNetCashFlow !== undefined
                  ? cashFlowData.totals.netCashFlow - cashFlowData.totals.comparisonNetCashFlow
                  : undefined
              }
            />
            <ReportCard
              title="Operating Cash Flow"
              value={cashFlowData.totals.netOperating}
            />
            <ReportCard
              title="Free Cash Flow"
              value={freeCashFlow}
            />
            <ReportCard
              title="Ending Cash"
              value={cashFlowData.totals.endingCash}
              trend={
                showComparison && cashFlowData.totals.comparisonEndingCash !== undefined
                  ? calculateTrend(
                      cashFlowData.totals.endingCash,
                      cashFlowData.totals.comparisonEndingCash
                    )
                  : undefined
              }
              trendValue={
                showComparison && cashFlowData.totals.comparisonEndingCash !== undefined
                  ? cashFlowData.totals.endingCash - cashFlowData.totals.comparisonEndingCash
                  : undefined
              }
            />
          </div>

          {/* Waterfall Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={20} />
                Cash Flow Components
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={waterfallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatReportCurrency(value)} />
                  <Tooltip
                    formatter={(value: number) => formatReportCurrency(value)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                  />
                  <ReferenceLine y={0} stroke="#000" />
                  <Bar dataKey="value">
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cash Balance Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} />
                Cash Balance Progression
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => formatReportCurrency(value)} />
                  <Tooltip
                    formatter={(value: number) => formatReportCurrency(value)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Operating Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Operating Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Current Period</th>
                      {showComparison && <th className="text-right py-2">Comparison</th>}
                      {showComparison && <th className="text-right py-2">Variance</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlowData.operatingActivities.map((line, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2">{line.description}</td>
                        <td className="text-right py-2">
                          {formatReportCurrency(line.current)}
                        </td>
                        {showComparison && (
                          <td className="text-right py-2">
                            {line.comparison !== undefined
                              ? formatReportCurrency(line.comparison)
                              : '-'}
                          </td>
                        )}
                        {showComparison && (
                          <td className="text-right py-2">
                            {line.comparison !== undefined
                              ? formatReportCurrency(line.current - line.comparison)
                              : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="font-semibold bg-muted">
                      <td className="py-2">Net Cash from Operating Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netOperating)}
                      </td>
                      {showComparison && <td className="text-right py-2">-</td>}
                      {showComparison && <td className="text-right py-2">-</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Investing Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Investing Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Current Period</th>
                      {showComparison && <th className="text-right py-2">Comparison</th>}
                      {showComparison && <th className="text-right py-2">Variance</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlowData.investingActivities.length === 0 ? (
                      <tr>
                        <td colSpan={showComparison ? 4 : 2} className="text-center py-4 text-muted-foreground">
                          No investing activities in this period
                        </td>
                      </tr>
                    ) : (
                      cashFlowData.investingActivities.map((line, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{line.description}</td>
                          <td className="text-right py-2">
                            {formatReportCurrency(line.current)}
                          </td>
                          {showComparison && (
                            <td className="text-right py-2">
                              {line.comparison !== undefined
                                ? formatReportCurrency(line.comparison)
                                : '-'}
                            </td>
                          )}
                          {showComparison && (
                            <td className="text-right py-2">
                              {line.comparison !== undefined
                                ? formatReportCurrency(line.current - line.comparison)
                                : '-'}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                    <tr className="font-semibold bg-muted">
                      <td className="py-2">Net Cash from Investing Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netInvesting)}
                      </td>
                      {showComparison && <td className="text-right py-2">-</td>}
                      {showComparison && <td className="text-right py-2">-</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Financing Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Financing Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Current Period</th>
                      {showComparison && <th className="text-right py-2">Comparison</th>}
                      {showComparison && <th className="text-right py-2">Variance</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlowData.financingActivities.length === 0 ? (
                      <tr>
                        <td colSpan={showComparison ? 4 : 2} className="text-center py-4 text-muted-foreground">
                          No financing activities in this period
                        </td>
                      </tr>
                    ) : (
                      cashFlowData.financingActivities.map((line, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{line.description}</td>
                          <td className="text-right py-2">
                            {formatReportCurrency(line.current)}
                          </td>
                          {showComparison && (
                            <td className="text-right py-2">
                              {line.comparison !== undefined
                                ? formatReportCurrency(line.comparison)
                                : '-'}
                            </td>
                          )}
                          {showComparison && (
                            <td className="text-right py-2">
                              {line.comparison !== undefined
                                ? formatReportCurrency(line.current - line.comparison)
                                : '-'}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                    <tr className="font-semibold bg-muted">
                      <td className="py-2">Net Cash from Financing Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netFinancing)}
                      </td>
                      {showComparison && <td className="text-right py-2">-</td>}
                      {showComparison && <td className="text-right py-2">-</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">Beginning Cash Balance</td>
                      <td className="text-right py-2 font-medium">
                        {formatReportCurrency(cashFlowData.totals.beginningCash)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">Net Cash from Operating Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netOperating)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">Net Cash from Investing Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netInvesting)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">Net Cash from Financing Activities</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netFinancing)}
                      </td>
                    </tr>
                    <tr className="border-b font-semibold">
                      <td className="py-2">Net Change in Cash</td>
                      <td className="text-right py-2">
                        {formatReportCurrency(cashFlowData.totals.netCashFlow)}
                      </td>
                    </tr>
                    <tr className="font-bold bg-muted">
                      <td className="py-3">Ending Cash Balance</td>
                      <td className="text-right py-3">
                        {formatReportCurrency(cashFlowData.totals.endingCash)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CashFlow;
