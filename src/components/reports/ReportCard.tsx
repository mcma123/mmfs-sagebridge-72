/**
 * Summary metric card with trend indicator
 */

import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatReportCurrency, formatPercentage, type TrendDirection } from '@/lib/reports/utils';
import { cn } from '@/lib/utils';

interface ReportCardProps {
  title: string;
  value: number;
  trend?: TrendDirection;
  trendValue?: number;
  trendPercentage?: number;
  description?: string;
  className?: string;
}

export function ReportCard({
  title,
  value,
  trend,
  trendValue,
  trendPercentage,
  description,
  className,
}: ReportCardProps) {
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <ArrowUp className="h-4 w-4" />;
    if (trend === 'down') return <ArrowDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{formatReportCurrency(value)}</p>

          {trend && (
            <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
              {getTrendIcon()}
              {trendValue !== undefined && (
                <span>{formatReportCurrency(Math.abs(trendValue))}</span>
              )}
              {trendPercentage !== undefined && (
                <span>({formatPercentage(trendPercentage)})</span>
              )}
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
