import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Wand2, TableProperties, CheckCircle, Settings2 } from 'lucide-react';

type StepType = 'upload' | 'map' | 'preview' | 'dest' | 'summary' | 'done';

type Totals = {
  count: number;
  valid: number;
  invalid: number;
  duplicate: number;
  excluded: number;
  debitTotal: number;
  creditTotal: number;
} | null;

type Props = {
  currentStep: StepType;
  totals: Totals;
};

function StepItem({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${active ? 'bg-sage-lightGray' : ''}`}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function formatAmt(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function WizardSidebar({ currentStep, totals }: Props) {
  return (
    <aside className="w-64 border-r bg-background p-6 space-y-6 overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps</CardTitle>
          <CardDescription className="text-xs">Progress through the import</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <StepItem active={currentStep === 'upload'} icon={<Upload className="w-4 h-4" />} label="Upload" />
            <StepItem active={currentStep === 'map'} icon={<Wand2 className="w-4 h-4" />} label="Mapping" />
            <StepItem active={currentStep === 'preview'} icon={<TableProperties className="w-4 h-4" />} label="Preview" />
            <StepItem active={currentStep === 'dest'} icon={<Settings2 className="w-4 h-4" />} label="Destinations" />
            <StepItem active={currentStep === 'summary'} icon={<CheckCircle className="w-4 h-4" />} label="Summary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Rows</dt><dd>{totals?.count ?? 0}</dd>
            <dt>Valid</dt><dd>{totals?.valid ?? 0}</dd>
            <dt>Invalid</dt><dd>{totals?.invalid ?? 0}</dd>
            <dt>Duplicates</dt><dd>{totals?.duplicate ?? 0}</dd>
            <dt>Excluded</dt><dd>{totals?.excluded ?? 0}</dd>
            <dt>Debit Total</dt><dd>{formatAmt(totals?.debitTotal ?? 0)}</dd>
            <dt>Credit Total</dt><dd>{formatAmt(totals?.creditTotal ?? 0)}</dd>
          </dl>
        </CardContent>
      </Card>
    </aside>
  );
}
