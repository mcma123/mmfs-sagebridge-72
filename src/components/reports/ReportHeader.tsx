/**
 * Shared report header component with title, date range, and export button
 */

import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  isExporting?: boolean;
  showExport?: boolean;
  children?: React.ReactNode;
}

export function ReportHeader({
  title,
  subtitle,
  onExport,
  isExporting = false,
  showExport = true,
  children,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {showExport && onExport && (
          <Button onClick={onExport} disabled={isExporting} variant="outline" size="sm">
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </>
            )}
          </Button>
        )}
      </div>

      {children && <div className="flex items-center gap-4">{children}</div>}
    </div>
  );
}
