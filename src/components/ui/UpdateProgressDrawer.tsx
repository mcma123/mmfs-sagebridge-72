import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectStatus } from '@/lib/store/projects';

export function UpdateProgressDrawer({
  isOpen,
  initialValue,
  initialStatus,
  onClose,
  onSave,
  onPreviewChange,
  saving,
  title = 'Update Progress',
}: {
  isOpen: boolean;
  initialValue: number;
  initialStatus: ProjectStatus;
  onClose: () => void;
  onSave: (value: number, note?: string, status?: ProjectStatus) => Promise<void> | void;
  onPreviewChange?: (value: number) => void;
  saving?: boolean;
  title?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);

  useEffect(() => { setValue(initialValue); }, [initialValue]);
  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  useEffect(() => {
    if (isOpen && onPreviewChange) onPreviewChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isOpen]);

  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const hasChanged = clamped !== Math.max(0, Math.min(100, Number.isFinite(initialValue) ? initialValue : 0));
  const statusChanged = status !== initialStatus;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label id="status-label" htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger id="status" aria-label="Project status" aria-labelledby="status-label">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {(['Draft','Active','Pending Approval','In Progress','Done','Cancelled'] as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label id="progress-label" htmlFor="progress-range">Progress: {clamped}%</Label>
            <div className="mt-2">
              <Slider id="progress-range" value={[clamped]} min={0} max={100} step={1} aria-label="Project progress" aria-labelledby="progress-label"
                onValueChange={(vals) => setValue(vals[0] ?? 0)} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Input type="number" inputMode="numeric" min={0} max={100} value={clamped}
                     onChange={(e) => {
                       const next = Number(e.target.value);
                       setValue(Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : clamped);
                     }}
                     aria-label="Progress percent"
                     aria-labelledby="progress-label"
                     autoFocus
                     className="w-24" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-2 min-h-[96px]" />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button onClick={() => onSave(clamped, note, status)} disabled={saving || (!hasChanged && !statusChanged)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}