import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Users, Shield, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardFilters } from '@/lib/api/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MarineInsuranceKPIsProps {
  filters?: DashboardFilters;
}

const MarineInsuranceKPIs: React.FC<MarineInsuranceKPIsProps> = ({ filters }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'marine-kpis', filters],
    queryFn: () => dashboardApi.getMarineKPIs(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load marine insurance KPIs. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const kpis = [
    {
      title: 'Outstanding Premium Receivables',
      value: formatCurrency(data?.premium_receivables || 0),
      change: `${data?.premium_receivables_change || 0 >= 0 ? '+' : ''}${data?.premium_receivables_change || 0}%`,
      trend: (data?.premium_receivables_change || 0) >= 0 ? 'up' : 'down',
      icon: DollarSign,
    },
    {
      title: 'CDANT Commission Payable',
      value: formatCurrency(data?.commission_payable || 0),
      change: `${data?.commission_payable_change || 0 >= 0 ? '+' : ''}${data?.commission_payable_change || 0}%`,
      trend: (data?.commission_payable_change || 0) >= 0 ? 'up' : 'down',
      icon: Users,
    },
    {
      title: 'Unreconciled Payments',
      value: `${data?.unreconciled_count || 0} items`,
      amount: formatCurrency(data?.unreconciled_amount || 0),
      trend: 'neutral',
      icon: AlertCircle,
      color: 'amber'
    },
    {
      title: 'Premium Income (MTD)',
      value: formatCurrency(data?.premium_income_mtd || 0),
      change: `${data?.premium_income_change || 0 >= 0 ? '+' : ''}${data?.premium_income_change || 0}%`,
      trend: (data?.premium_income_change || 0) >= 0 ? 'up' : 'down',
      icon: TrendingUp,
    },
    {
      title: 'Claims Ratio',
      value: formatPercent(data?.claims_ratio || 0),
      change: `${data?.claims_ratio_change || 0 >= 0 ? '+' : ''}${data?.claims_ratio_change || 0}%`,
      trend: (data?.claims_ratio_change || 0) <= 0 ? 'down' : 'up', // Lower is better for claims ratio
      icon: Shield,
      description: 'Claims / Premium Income'
    },
    {
      title: 'Reinsurance Utilization',
      value: formatPercent(data?.reinsurance_utilization || 0),
      change: `${data?.reinsurance_utilization_change || 0 >= 0 ? '+' : ''}${data?.reinsurance_utilization_change || 0}%`,
      trend: (data?.reinsurance_utilization_change || 0) >= 0 ? 'up' : 'down',
      icon: FileText,
      description: 'Ceded / Gross Premium'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {kpis.map((kpi, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.title}
            </CardTitle>
            <kpi.icon className={`h-4 w-4 ${
              kpi.color === 'amber' ? 'text-amber-600' : 'text-sage-blue'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  {kpi.value}
                </div>
                {kpi.change && (
                  <div className={`flex items-center text-xs font-medium ${
                    kpi.trend === 'up' 
                      ? 'text-green-600' 
                      : kpi.trend === 'down' 
                      ? 'text-red-600' 
                      : 'text-muted-foreground'
                  }`}>
                    {kpi.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : kpi.trend === 'down' ? (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    ) : null}
                    {kpi.change}
                  </div>
                )}
              </div>
              
              {kpi.aging && (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Current:</span>
                    <span className="font-medium">{kpi.aging.current}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>Overdue:</span>
                    <span className="font-medium">{kpi.aging.overdue}</span>
                  </div>
                </div>
              )}
              
              {kpi.amount && (
                <div className="text-xs text-muted-foreground">
                  Total: <span className="font-medium">{kpi.amount}</span>
                </div>
              )}
              
              {kpi.target && (
                <div className="text-xs text-muted-foreground">
                  {kpi.target}
                </div>
              )}
              
              {kpi.description && (
                <div className="text-xs text-muted-foreground">
                  {kpi.description}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MarineInsuranceKPIs;
