
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDownUp, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardFilters } from '@/lib/api/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RecentTransactionsProps {
  filters?: DashboardFilters;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ filters }) => {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'recent-transactions', filters],
    queryFn: () => dashboardApi.getRecentTransactions(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-0">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36 mt-2" />
        </CardHeader>
        <CardContent className="py-4">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load recent transactions. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const transactions = response?.items || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-0 flex justify-between items-center">
        <div>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Latest financial activities</p>
        </div>
        <button className="text-primary-500 text-sm font-medium hover:text-primary-600 transition-colors inline-flex items-center">
          View All <ChevronRight size={14} className="ml-1" />
        </button>
      </CardHeader>
      <CardContent className="py-4">
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent transactions</p>
          ) : (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-sage-lightGray transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    transaction.type === 'income' ? "bg-green-100" : "bg-red-100"
                  )}>
                    <ArrowDownUp
                      size={16}
                      className={transaction.type === 'income' ? "text-green-600" : "text-red-600"}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transaction.date)}
                      {transaction.reference && ` • ${transaction.reference}`}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "font-medium",
                  transaction.type === 'income' ? "text-green-600" : "text-red-600"
                )}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentTransactions;
