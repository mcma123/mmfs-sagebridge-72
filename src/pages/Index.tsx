import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import FinancialOverview from '@/components/dashboard/FinancialOverview';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import UpcomingPayments from '@/components/dashboard/UpcomingPayments';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import MarineInsuranceKPIs from '@/components/dashboard/MarineInsuranceKPIs';
import { ReconciliationStatus } from '@/components/dashboard/ReconciliationStatus';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { motion } from 'framer-motion';

const Index: React.FC = () => {
  const { getApiFilters } = useDashboardFilters();
  const filters = getApiFilters();

  return (
    <MainLayout>
      <motion.div
        className="space-y-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 pb-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MMFS Dashboard</h1>
          </div>
        </div>

        <FilterBar />

        <div className="space-y-6 p-6">
          <MarineInsuranceKPIs filters={filters} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <PerformanceChart filters={filters} />
            </div>
            <div>
              <UpcomingPayments filters={filters} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <RecentTransactions filters={filters} />
            </div>
            <div>
              <ReconciliationStatus />
            </div>
          </div>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default Index;
