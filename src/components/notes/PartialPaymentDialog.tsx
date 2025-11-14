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
import { recordPartialPayment, type PartialPaymentRequest, type AccountDTO } from '@/lib/api/accounting';
import { toast } from 'sonner';

interface PartialPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: number;
  journalReference: string;
  totalAmount: number;
  paidAmount: number;
  bankAccounts: AccountDTO[];
  onSuccess: () => void;
  userRole: 'admin' | 'accountant' | 'editor' | 'viewer';
  userId: number;
}

export function PartialPaymentDialog({
  open,
  onOpenChange,
  journalId,
  journalReference,
  totalAmount,
  paidAmount,
  bankAccounts,
  onSuccess,
  userRole,
  userId,
}: PartialPaymentDialogProps) {
  const [amount, setAmount] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingAmount = totalAmount - paidAmount;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setBankAccountId('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const paymentAmount = parseFloat(amount);

    if (!amount || isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > remainingAmount) {
      toast.error('Payment amount cannot exceed remaining balance');
      return;
    }

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
      const payload: PartialPaymentRequest = {
        amount: paymentAmount,
        bank_account_id: parseInt(bankAccountId),
        payment_date: paymentDate,
        notes: notes || undefined,
      };

      const result = await recordPartialPayment(journalId, payload, userRole, userId);

      toast.success(`Partial payment recorded`, {
        description: `Paid: R${result.amount.toFixed(2)} | Remaining: R${result.remaining.toFixed(2)}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to record partial payment:', error);
      toast.error('Failed to record partial payment', {
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
            <DialogTitle>Record Partial Payment</DialogTitle>
            <DialogDescription>
              Record a partial payment for {journalReference}
              <br />
              <span className="font-medium">
                Total: R{totalAmount.toFixed(2)} | Paid: R{paidAmount.toFixed(2)} | Remaining: R
                {remainingAmount.toFixed(2)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Payment Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingAmount}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Maximum: R{remainingAmount.toFixed(2)}
              </p>
            </div>

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
              {isSubmitting ? 'Recording Payment...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
