/**
 * Reports Page - Navigation and routing for all financial reports
 */

import React from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, PieChart as PieChartIcon, Activity, DollarSign, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Available reports
  const reports = [
    { id: 'balance-sheet', name: 'Balance Sheet', icon: <FileText size={16} />, path: '/reports/balance-sheet' },
    { id: 'expenses', name: 'Expense Report', icon: <BarChart2 size={16} />, path: '/reports/expenses' },
    { id: 'tax', name: 'Tax Summary', icon: <Receipt size={16} />, path: '/reports/tax-summary' },
    { id: 'receivables', name: 'Accounts Receivable', icon: <DollarSign size={16} />, path: '/reports/receivables' },
    { id: 'payables', name: 'Accounts Payable', icon: <PieChartIcon size={16} />, path: '/reports/payables' },
    { id: 'cash-flow', name: 'Cash Flow', icon: <Activity size={16} />, path: '/reports/cash-flow' },
  ];

  // If on base /reports route, redirect to balance-sheet
  if (location.pathname === '/reports') {
    return <Navigate to="/reports/balance-sheet" replace />;
  }

  const activeReport = reports.find(r => location.pathname === r.path);

  return (
    <MainLayout>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Financial and business reports</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Report Types</CardTitle>
              </CardHeader>
              <CardContent className="px-2 py-1">
                <nav>
                  <ul className="space-y-1">
                    {reports.map((report) => (
                      <li key={report.id}>
                        <button
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center',
                            location.pathname === report.path
                              ? 'bg-primary-500 text-white'
                              : 'hover:bg-muted text-foreground',
                            report.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                          onClick={() => !report.disabled && navigate(report.path)}
                          disabled={report.disabled}
                        >
                          <span className="mr-2">{report.icon}</span>
                          {report.name}
                          {report.disabled && <span className="ml-auto text-xs">(Coming Soon)</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Report Content Area */}
          <div className="lg:col-span-3">
            <Outlet />
          </div>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default Reports;

