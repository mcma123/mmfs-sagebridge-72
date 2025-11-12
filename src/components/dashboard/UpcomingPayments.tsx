
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardFilters } from '@/lib/api/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UpcomingPaymentsProps {
  filters?: DashboardFilters;
}

const UpcomingPayments: React.FC<UpcomingPaymentsProps> = ({ filters }) => {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'upcoming-payments', filters],
    queryFn: () => dashboardApi.getUpcomingPayments(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
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

  const getDaysRemaining = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border-b">
                <div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
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
          <CardTitle className="text-lg">Upcoming Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load upcoming payments. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const payments = response?.items || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">Upcoming Payments</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Bills and invoices due soon</p>
      </CardHeader>
      <CardContent className="py-4">
        <div className="space-y-4">
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No upcoming payments</p>
          ) : (
            payments.map((payment) => {
              const daysRemaining = getDaysRemaining(payment.due_date);
              const isOverdue = payment.payment_status === 'overdue';

              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-sage-lightGray transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-primary-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sage-lightGray flex items-center justify-center">
                      <Calendar size={16} className="text-sage-blue" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{payment.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(payment.due_date)}
                        {payment.entity_name && ` • ${payment.entity_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <div className="flex items-center mt-1 justify-end">
                      <Clock size={12} className={cn(
                        isOverdue ? "text-red-500" : payment.payment_status === 'due_today' ? "text-orange-500" : "text-amber-500"
                      )} />
                      <span className={cn(
                        "text-xs ml-1",
                        isOverdue ? "text-red-500" : payment.payment_status === 'due_today' ? "text-orange-500" : "text-amber-500"
                      )}>
                        {isOverdue
                          ? `${Math.abs(daysRemaining)} days overdue`
                          : payment.payment_status === 'due_today'
                          ? 'Due today'
                          : `${daysRemaining} days left`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UpcomingPayments;
