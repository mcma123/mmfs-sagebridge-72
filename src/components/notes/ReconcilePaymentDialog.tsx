import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { reconcilePayment } from '@/lib/api/accounting';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

interface ReconcilePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: number;
  journalReference: string;
  onSuccess: () => void;
  userRole: 'admin' | 'accountant' | 'editor' | 'viewer';
  userId: number;
}

export function ReconcilePaymentDialog({
  open,
  onOpenChange,
  journalId,
  journalReference,
  onSuccess,
  userRole,
  userId,
}: ReconcilePaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      await reconcilePayment(journalId, userRole, userId);

      toast.success('Payment reconciled', {
        description: `${journalReference} has been marked as reconciled`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to reconcile payment:', error);
      toast.error('Failed to reconcile payment', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Reconcile Payment
          </DialogTitle>
          <DialogDescription>
            Mark payment as reconciled for {journalReference}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            This action will mark the payment as verified and reconciled. This indicates that the
            payment has been confirmed against bank statements or other verification methods.
          </p>
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
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Reconciling...' : 'Confirm Reconciliation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
