
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardFilters } from '@/lib/api/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PerformanceChartProps {
  filters?: DashboardFilters;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ filters }) => {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'performance', filters],
    queryFn: () => dashboardApi.getPerformance(7, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-0">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36 mt-2" />
        </CardHeader>
        <CardContent className="pt-6">
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Financial Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load performance data. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = response?.items.map(item => ({
    name: item.month_name,
    income: Number(item.income),
    expenses: Number(item.expenses),
  })) || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">Financial Performance</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Income vs Expenses trends</p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#888" />
              <YAxis 
                tickFormatter={(value) => `R${value}`} 
                tick={{ fontSize: 12 }} 
                stroke="#888"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value) => [`R${value}`, undefined]}
                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                iconSize={8}
              />
              <Area 
                type="monotone" 
                dataKey="income" 
                stackId="1" 
                stroke="#0077c8" 
                fill="#0077c8" 
                fillOpacity={0.2}
                strokeWidth={2}
                name="Income"
              />
              <Area 
                type="monotone" 
                dataKey="expenses" 
                stackId="1" 
                stroke="#ff6b6b" 
                fill="#ff6b6b" 
                fillOpacity={0.1}
                strokeWidth={2}
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
