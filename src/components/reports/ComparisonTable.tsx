/**
 * Reusable table with current/comparison/variance columns
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatReportCurrency, formatPercentage, calculateVariance } from '@/lib/reports/utils';
import { cn } from '@/lib/utils';

export interface ComparisonTableRow {
  id: string | number;
  label: string;
  current: number;
  comparison?: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

interface ComparisonTableProps {
  rows: ComparisonTableRow[];
  currentLabel?: string;
  comparisonLabel?: string;
  showComparison?: boolean;
}

export function ComparisonTable({
  rows,
  currentLabel = 'Current',
  comparisonLabel = 'Previous',
  showComparison = true,
}: ComparisonTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Account</TableHead>
            <TableHead className="text-right">{currentLabel}</TableHead>
            {showComparison && (
              <>
                <TableHead className="text-right">{comparisonLabel}</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Change %</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const variance =
              showComparison && row.comparison !== undefined
                ? calculateVariance(row.current, row.comparison)
                : null;

            const rowClass = cn({
              'font-bold bg-muted/50': row.isTotal,
              'font-semibold bg-muted/30': row.isSubtotal,
            });

            const labelClass = cn({
              'pl-8': row.indent === 1,
              'pl-12': row.indent === 2,
              'pl-16': row.indent === 3,
            });

            return (
              <TableRow key={row.id} className={rowClass}>
                <TableCell className={labelClass}>{row.label}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatReportCurrency(row.current)}
                </TableCell>

                {showComparison && (
                  <>
                    <TableCell className="text-right font-mono">
                      {row.comparison !== undefined
                        ? formatReportCurrency(row.comparison)
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-mono', {
                        'text-green-600': variance && variance.direction === 'increase',
                        'text-red-600': variance && variance.direction === 'decrease',
                      })}
                    >
                      {variance ? formatReportCurrency(variance.amount) : '-'}
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-mono', {
                        'text-green-600': variance && variance.direction === 'increase',
                        'text-red-600': variance && variance.direction === 'decrease',
                      })}
                    >
                      {variance ? formatPercentage(variance.percentage) : '-'}
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
