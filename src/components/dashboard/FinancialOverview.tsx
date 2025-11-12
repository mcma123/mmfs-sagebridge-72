
import React from 'react';
import { ArrowDown, ArrowUp, DollarSign, Users, ShoppingCart, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, delay = 0 }) => {
  const isPositive = change > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5,
        delay: delay * 0.1,
        ease: [0.42, 0, 0.58, 1]
      }}
    >
      <Card>
        <CardHeader className="pb-2 flex justify-between items-start">
          <CardTitle className="text-base text-muted-foreground font-medium">
            {title}
          </CardTitle>
          <div className="p-2 rounded-full bg-sage-lightGray">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-2xl font-bold">{value}</h3>
          <div className="flex items-center mt-1">
            <div className={cn(
              "flex items-center text-xs font-medium",
              isPositive ? "text-green-600" : "text-red-600"
            )}>
              {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="ml-1">{Math.abs(change)}%</span>
            </div>
            <span className="text-xs text-muted-foreground ml-1">vs last month</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const FinancialOverview: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardApi.getOverview,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  // Format currency for ZAR
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40 mb-2" />
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
          Failed to load financial overview. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const stats = [
    {
      title: "Total Cash Flow",
      value: formatCurrency(data?.total_cash_flow || 0),
      change: data?.total_cash_flow_change || 0,
      icon: <DollarSign size={16} className="text-sage-blue" />
    },
    {
      title: "Accounts Receivable",
      value: formatCurrency(data?.accounts_receivable || 0),
      change: data?.accounts_receivable_change || 0,
      icon: <Users size={16} className="text-sage-blue" />
    },
    {
      title: "Accounts Payable",
      value: formatCurrency(data?.accounts_payable || 0),
      change: data?.accounts_payable_change || 0,
      icon: <ShoppingCart size={16} className="text-sage-blue" />
    },
    {
      title: "Bank Balance",
      value: formatCurrency(data?.bank_balance || 0),
      change: data?.bank_balance_change || 0,
      icon: <CreditCard size={16} className="text-sage-blue" />
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat, index) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
          delay={index}
        />
      ))}
    </div>
  );
};

export default FinancialOverview;
