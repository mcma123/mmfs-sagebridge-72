import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Totals = {
  count: number;
  valid: number;
  invalid: number;
  duplicate: number;
  excluded: number;
} | null;

type Props = {
  totals: Totals;
  isCommitting: boolean;
  commitError: string | null;
  onBack: () => void;
  onCommit: () => void;
};

export default function SummaryStep({ totals, isCommitting, commitError, onBack, onCommit }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
        <CardDescription>Review and confirm commit</CardDescription>
      </CardHeader>
      <CardContent>
        {commitError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
            {commitError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>Rows</div><div>{totals?.count ?? 0}</div>
          <div>Valid</div><div>{totals?.valid ?? 0}</div>
          <div>Invalid</div><div>{totals?.invalid ?? 0}</div>
          <div>Duplicates</div><div>{totals?.duplicate ?? 0}</div>
          <div>Excluded</div><div>{totals?.excluded ?? 0}</div>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isCommitting}>Back</Button>
          <Button onClick={onCommit} disabled={isCommitting}>
            {isCommitting ? 'Committing...' : 'Commit Import'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
