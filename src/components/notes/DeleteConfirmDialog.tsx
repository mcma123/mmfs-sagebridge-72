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
import { deleteJournal } from '@/lib/api/accounting';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: number;
  journalReference: string;
  noteType: 'debit' | 'credit';
  onSuccess: () => void;
  userRole: 'admin' | 'accountant' | 'editor' | 'viewer';
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  journalId,
  journalReference,
  noteType,
  onSuccess,
  userRole,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);

    try {
      await deleteJournal(journalId, userRole);

      toast.success(`${noteType === 'debit' ? 'Debit' : 'Credit'} note deleted`, {
        description: `${journalReference} has been permanently removed`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {noteType === 'debit' ? 'Debit' : 'Credit'} Note
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete {journalReference}?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-2">
              ⚠️ This action cannot be undone
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>The note and all its lines will be permanently removed</li>
              <li>All related payment records will be deleted</li>
              <li>This operation cannot be reversed</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
