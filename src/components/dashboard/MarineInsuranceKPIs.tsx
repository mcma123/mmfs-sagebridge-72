import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Users, Shield, FileText } from 'lucide-react';

const MarineInsuranceKPIs = () => {
  const kpis = [
    {
      title: 'Outstanding Premium Receivables',
      value: 'R 245,500',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      aging: { current: 'R 180,000', overdue: 'R 65,500' }
    },
    {
      title: 'CDANT Commission Payable',
      value: 'R 122,300',
      change: '+8.3%',
      trend: 'up',
      icon: Users,
      aging: { current: 'R 95,000', overdue: 'R 27,300' }
    },
    {
      title: 'Unreconciled Payments',
      value: '15 items',
      amount: 'R 89,750',
      trend: 'neutral',
      icon: AlertCircle,
      color: 'amber'
    },
    {
      title: 'Premium Income (MTD)',
      value: 'R 324,500',
      change: '+18.2%',
      trend: 'up',
      icon: TrendingUp,
      target: 'Target: R 400,000'
    },
    {
      title: 'Claims Ratio',
      value: '45.2%',
      change: '-3.1%',
      trend: 'down',
      icon: Shield,
      description: 'Claims / Premium Income'
    },
    {
      title: 'Reinsurance Utilization',
      value: '62.8%',
      change: '+5.4%',
      trend: 'up',
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
