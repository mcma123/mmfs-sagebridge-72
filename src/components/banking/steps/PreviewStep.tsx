import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { NormalizedTransaction } from '@/lib/banking/models';

type Props = {
  rows: NormalizedTransaction[];
  updateCell: (rowId: string, field: string, value: any) => void;
  toggleExclude: (rowId: string, checked: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
};

export default function PreviewStep({ rows, updateCell, toggleExclude, onBack, onContinue }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview & Clean</CardTitle>
        <CardDescription>Fix invalid rows, exclude duplicates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto h-[calc(100vh-20rem)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Exclude</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow
                  key={r.id}
                  className={r.validationStatus === 'invalid' ? 'bg-red-50' : r.duplicateFlag ? 'bg-yellow-50' : ''}
                >
                  <TableCell>
                    <Checkbox checked={r.excluded} onCheckedChange={(c: any) => toggleExclude(r.id, !!c)} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.date || ''} onChange={e => updateCell(r.id, 'date', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={r.description || ''} onChange={e => updateCell(r.id, 'description', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={r.amount ?? ''} onChange={e => updateCell(r.id, 'amount', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>{r.debit ?? ''}</TableCell>
                  <TableCell>{r.credit ?? ''}</TableCell>
                  <TableCell>
                    <Input value={r.accountCode || ''} onChange={e => updateCell(r.id, 'accountCode', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={r.reference || ''} onChange={e => updateCell(r.id, 'reference', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={r.currency || ''} onChange={e => updateCell(r.id, 'currency', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{r.validationStatus}{r.duplicateFlag ? ' • dup' : ''}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}
