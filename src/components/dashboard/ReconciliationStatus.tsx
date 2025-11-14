import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';

export function ReconciliationStatus() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reconciliation-summary'],
    queryFn: dashboardApi.getReconciliationSummary,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Payment Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Payment Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load reconciliation status: {(error as Error).message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasUnallocated = data && data.unallocated_count > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Payment Reconciliation
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/payment-reconciliation')}
            className="text-sm"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unallocated Payments Summary */}
        <div
          className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
            hasUnallocated
              ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900'
              : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
          }`}
          onClick={() => navigate('/payment-reconciliation')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className={`h-5 w-5 ${hasUnallocated ? 'text-amber-600' : 'text-green-600'}`} />
              <span className="font-semibold">Unallocated Payments</span>
            </div>
            {hasUnallocated ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Action Required
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                All Clear
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-muted-foreground">Count</p>
              <p className={`text-2xl font-bold ${hasUnallocated ? 'text-amber-600' : 'text-green-600'}`}>
                {data?.unallocated_count || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className={`text-2xl font-bold ${hasUnallocated ? 'text-amber-600' : 'text-green-600'}`}>
                {formatCurrency(data?.unallocated_amount || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Reconciliations */}
        {data?.recent_reconciliations && data.recent_reconciliations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Recent Reconciliations</h4>
            <div className="space-y-2">
              {data.recent_reconciliations.map((reconciliation) => (
                <div
                  key={reconciliation.id}
                  className="p-3 border rounded-md hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {reconciliation.reference || `Transaction #${reconciliation.id}`}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        reconciliation.status === 'matched'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }
                    >
                      {reconciliation.status === 'matched' ? 'Fully Matched' : 'Partially Matched'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(reconciliation.transaction_date)}</span>
                    <span>
                      {formatCurrency(reconciliation.amount)} • {reconciliation.allocation_count} allocation(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!data?.recent_reconciliations || data.recent_reconciliations.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No recent reconciliations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
