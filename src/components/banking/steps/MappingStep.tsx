import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

type AnalysisResult = {
  headers: string[];
};

const systemFields = [
  { label: 'Date', value: 'date' },
  { label: 'Description', value: 'description' },
  { label: 'Amount', value: 'amount' },
  { label: 'Debit', value: 'debit' },
  { label: 'Credit', value: 'credit' },
  { label: 'Account', value: 'accountCode' },
  { label: 'Reference', value: 'reference' },
  { label: 'Currency', value: 'currency' },
] as const;

type Props = {
  analysis: AnalysisResult;
  templateName: string;
  setTemplateName: (value: string) => void;
  bankName: string;
  setBankName: (value: string) => void;
  fixedCurrency: string;
  setFixedCurrency: (value: string) => void;
  defaultAccountCode: string;
  setDefaultAccountCode: (value: string) => void;
  invertSigns: boolean;
  setInvertSigns: (value: boolean) => void;
  mapping: Record<string, string | undefined>;
  setMapping: (mapping: Record<string, string | undefined>) => void;
  isStaging: boolean;
  stagingError: string | null;
  onStage: () => void;
  onBack: () => void;
};

export default function MappingStep({
  analysis,
  templateName,
  setTemplateName,
  bankName,
  setBankName,
  fixedCurrency,
  setFixedCurrency,
  defaultAccountCode,
  setDefaultAccountCode,
  invertSigns,
  setInvertSigns,
  mapping,
  setMapping,
  isStaging,
  stagingError,
  onStage,
  onBack,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Map Columns</CardTitle>
        <CardDescription>Assign CSV headers to system fields</CardDescription>
      </CardHeader>
      <CardContent>
        {stagingError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
            {stagingError}
          </div>
        )}
        {isStaging && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span>Staging rows...</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm">Template Name</label>
            <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. FNB Checking" />
          </div>
          <div>
            <label className="text-sm">Bank</label>
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. First National Bank" />
          </div>
          <div>
            <label className="text-sm">Fixed Currency</label>
            <Input value={fixedCurrency} onChange={e => setFixedCurrency(e.target.value.toUpperCase())} placeholder="e.g. USD" />
          </div>
          <div>
            <label className="text-sm">Default Account Code</label>
            <Input value={defaultAccountCode} onChange={e => setDefaultAccountCode(e.target.value)} placeholder="e.g. 11001" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={invertSigns} onCheckedChange={(c: any) => setInvertSigns(!!c)} />
            <span className="text-sm">Invert signs (swap debit/credit)</span>
          </div>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>CSV Header</TableHead>
                <TableHead>Map To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.headers.map(h => (
                <TableRow key={h}>
                  <TableCell className="font-mono text-xs">{h}</TableCell>
                  <TableCell>
                    <Select
                      value={mapping[h] || '__none__'}
                      onValueChange={(v) => setMapping({ ...mapping, [h]: v === '__none__' ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {systemFields.map(sf => (
                          <SelectItem key={sf.value} value={sf.value}>{sf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onStage} disabled={isStaging}>
            {isStaging ? 'Staging...' : 'Stage Rows'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
