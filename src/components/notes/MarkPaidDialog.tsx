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
import { markNotePaid, type MarkPaidRequest, type AccountDTO } from '@/lib/api/accounting';
import { toast } from 'sonner';

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: number;
  journalReference: string;
  totalAmount: number;
  bankAccounts: AccountDTO[];
  onSuccess: () => void;
  userRole: 'admin' | 'accountant' | 'editor' | 'viewer';
  userId: number;
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  journalId,
  journalReference,
  totalAmount,
  bankAccounts,
  onSuccess,
  userRole,
  userId,
}: MarkPaidDialogProps) {
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setBankAccountId('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankAccountId) {
      toast.error('Please select a bank account');
      return;
    }

    if (!paymentDate) {
      toast.error('Please select a payment date');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: MarkPaidRequest = {
        bank_account_id: parseInt(bankAccountId),
        payment_date: paymentDate,
        notes: notes || undefined,
      };

      const result = await markNotePaid(journalId, payload, userRole, userId);

      toast.success(`Payment recorded successfully`, {
        description: `Payment reference: ${result.payment_reference}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to mark as paid:', error);
      toast.error('Failed to mark as paid', {
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
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record full payment for {journalReference}. Amount: R{totalAmount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bank-account">Bank Account *</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId} required>
                <SelectTrigger id="bank-account">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payment-date">Payment Date *</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this payment..."
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording Payment...' : 'Mark as Paid'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
