import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { applyCredit, type ApplyCreditRequest, type JournalDTO } from '@/lib/api/accounting';
import { toast } from 'sonner';

interface ApplyCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: number;
  creditNoteReference: string;
  creditNoteAmount: number;
  debitNotes: JournalDTO[]; // List of available debit notes
  onSuccess: () => void;
  userRole: 'admin' | 'accountant' | 'editor' | 'viewer';
  userId: number;
}

export function ApplyCreditDialog({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteReference,
  creditNoteAmount,
  debitNotes,
  onSuccess,
  userRole,
  userId,
}: ApplyCreditDialogProps) {
  const [debitNoteId, setDebitNoteId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [appliedDate, setAppliedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDebitNoteId('');
      setAmount(creditNoteAmount.toString());
      setAppliedDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open, creditNoteAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!debitNoteId) {
      toast.error('Please select a debit note');
      return;
    }

    const applyAmount = parseFloat(amount);

    if (!amount || isNaN(applyAmount) || applyAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (applyAmount > creditNoteAmount) {
      toast.error('Amount cannot exceed credit note total');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ApplyCreditRequest = {
        debit_note_id: parseInt(debitNoteId),
        amount: applyAmount,
        applied_date: appliedDate,
        notes: notes || undefined,
      };

      const result = await applyCredit(creditNoteId, payload, userRole, userId);

      const selectedDebitNote = debitNotes.find((dn) => dn.id === parseInt(debitNoteId));

      toast.success('Credit note applied', {
        description: `${creditNoteReference} applied to ${selectedDebitNote?.reference || 'debit note'}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to apply credit:', error);
      toast.error('Failed to apply credit', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Apply Credit to Debit Note</DialogTitle>
            <DialogDescription>
              Apply {creditNoteReference} (R{creditNoteAmount.toFixed(2)}) to a debit note
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="debit-note">Debit Note *</Label>
              <Select value={debitNoteId} onValueChange={setDebitNoteId} required>
                <SelectTrigger id="debit-note">
                  <SelectValue placeholder="Select debit note" />
                </SelectTrigger>
                <SelectContent>
                  {debitNotes.map((note) => (
                    <SelectItem key={note.id} value={String(note.id)}>
                      {note.reference} - R{note.total_amount?.toFixed(2) || '0.00'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {debitNotes.length === 0 && (
                <p className="text-sm text-yellow-600">No unpaid debit notes available</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={creditNoteAmount}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Maximum: R{creditNoteAmount.toFixed(2)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="applied-date">Application Date *</Label>
              <Input
                id="applied-date"
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this application..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || debitNotes.length === 0}>
              {isSubmitting ? 'Applying Credit...' : 'Apply Credit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
