
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isAccountingDocumentsEnabled } from '@/lib/flags';
import {
  FileText, 
  BookOpen, 
  BarChart4, 
  RefreshCw, 
  PlusCircle, 
  ChevronRight,
  Book,
  FilePlus2,
  Calculator,
  Wallet,
  CircleDollarSign,
  Receipt
} from 'lucide-react';

const AccountingModules = [
  {
    title: "Documents",
    description: "Store and organize accounting documents",
    icon: FileText,
    path: "/accounting/documents",
  },
  {
    title: "Chart of Accounts",
    description: "Manage your list of accounts and categories",
    icon: BookOpen,
    path: "/accounting/chart-of-accounts",
  },
  {
    title: "Journal Entries",
    description: "Create and manage journal transactions",
    icon: FileText,
    path: "/accounting/journals",
  },
  {
    title: "General Ledger",
    description: "View all posted financial transactions",
    icon: Book,
    path: "/accounting/general-ledger",
  },
  {
    title: "Trial Balance",
    description: "View account balances at a specific date",
    icon: Calculator,
    path: "/accounting/trial-balance",
  },
  {
    title: "Financial Reports",
    description: "Access income statements, balance sheets and more",
    icon: BarChart4,
    path: "/reports",
  },
  {
    title: "Period End",
    description: "Perform month-end and year-end closing procedures",
    icon: RefreshCw,
    path: "/accounting/period-end",
  }
];

const QuickActions = [
  {
    title: "Add New Account",
    icon: PlusCircle,
    path: "/accounting/add-account",
  },
  {
    title: "New Journal Entry",
    icon: FilePlus2,
    path: "/accounting/journals/new",
  },
  {
    title: "Reconcile Accounts",
    icon: Wallet,
    path: "/payment-reconciliation",
  },
  {
    title: "Adjust Opening Balance",
    icon: CircleDollarSign,
    path: "/accounting/adjust-opening-balance",
  },
  {
    title: "Tax Reports",
    icon: Receipt,
    path: "/accounting/tax-reports",
  }
];

const Accounting = () => {
  const navigate = useNavigate();
  const modulesToShow = AccountingModules.filter((m) => m.path !== '/accounting/documents' || isAccountingDocumentsEnabled());
  
  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="text-sm text-muted-foreground mt-1">Marine Insurance Accounting Module</p>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recent">Recent Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {QuickActions.map((action) => (
                    <button
                      key={action.title}
                      className="flex flex-col items-center justify-center p-4 bg-white border border-border rounded-lg hover:bg-sage-lightGray transition-colors text-center"
                      onClick={() => navigate(action.path)}
                    >
                      <action.icon className="h-8 w-8 mb-2 text-sage-blue" />
                      <span className="text-sm font-medium">{action.title}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Accounting Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {modulesToShow.map((module) => (
                <Card 
                  key={module.title}
                  className="hover:shadow-md transition-shadow cursor-pointer border-none shadow-sm"
                  onClick={() => navigate(module.path)}
                >
                  <CardHeader className="pb-2 flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-sage-lightGray">
                        <module.icon className="h-5 w-5 text-sage-blue" />
                      </div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{module.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="recent">
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Recent transactions will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MainLayout>
  );
};

export default Accounting;
