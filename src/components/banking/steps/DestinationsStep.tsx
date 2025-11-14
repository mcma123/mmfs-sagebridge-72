import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DestinationSelection } from '@/lib/banking/models';

type Props = {
  dest: DestinationSelection;
  setDest: (dest: DestinationSelection) => void;
  onBack: () => void;
  onContinue: () => void;
};

export default function DestinationsStep({ dest, setDest, onBack, onContinue }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Destinations</CardTitle>
        <CardDescription>Select where to commit imported entries</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dest.journalEntries}
              onCheckedChange={(c: any) => setDest({ ...dest, journalEntries: !!c })}
            />
            Journal Entries
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dest.trialBalance}
              onCheckedChange={(c: any) => setDest({ ...dest, trialBalance: !!c })}
            />
            Trial Balance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dest.chartOfAccounts}
              onCheckedChange={(c: any) => setDest({ ...dest, chartOfAccounts: !!c })}
            />
            Chart of Accounts
          </label>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}
