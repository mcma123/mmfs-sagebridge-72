import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import FinancialOverview from '@/components/dashboard/FinancialOverview';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import UpcomingPayments from '@/components/dashboard/UpcomingPayments';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import MarineInsuranceKPIs from '@/components/dashboard/MarineInsuranceKPIs';
import { motion } from 'framer-motion';

const Index: React.FC = () => {
  return (
    <MainLayout>
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MMFS Dashboard</h1>
            <p className="text-muted-foreground">Mzansi Marine & Freight Solutions</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-sage-lightGray border-0 rounded-md text-sm py-2 pl-3 pr-8 focus:ring-1 focus:ring-primary-500">
              <option>This Month</option>
              <option>Last Month</option>
              <option>Last Quarter</option>
              <option>This Year</option>
            </select>
            <button className="bg-primary-500 hover:bg-primary-600 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors">
              Export Report
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          <MarineInsuranceKPIs />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <PerformanceChart />
            </div>
            <div>
              <UpcomingPayments />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <RecentTransactions />
            </div>
            <div>
              <div className="bg-primary-100 p-5 rounded-lg border border-primary-200 h-full">
                <h3 className="font-semibold text-lg text-primary-800">Quick Actions</h3>
                <div className="space-y-3 mt-4">
                  <button className="bg-white hover:bg-sage-lightGray text-sage-darkGray w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors text-left shadow-sm">
                    New Journal Entry
                  </button>
                  <button className="bg-white hover:bg-sage-lightGray text-sage-darkGray w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors text-left shadow-sm">
                    Issue Debit/Credit Note
                  </button>
                  <button className="bg-white hover:bg-sage-lightGray text-sage-darkGray w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors text-left shadow-sm">
                    Reconcile Payments
                  </button>
                  <button className="bg-white hover:bg-sage-lightGray text-sage-darkGray w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors text-left shadow-sm">
                    Marine Insurance Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default Index;
