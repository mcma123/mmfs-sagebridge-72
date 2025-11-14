import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createBankTransaction, importBankStatement } from '@/lib/api/accounting';
import { Loader2, Upload, Plus } from 'lucide-react';

// Manual entry form schema
const manualEntrySchema = z.object({
  transaction_date: z.string().min(1, 'Transaction date is required'),
  reference: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  entity_name: z.string().optional(),
  description: z.string().optional(),
});

type ManualEntryForm = z.infer<typeof manualEntrySchema>;

interface ImportPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportPaymentDialogProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchDescription, setBatchDescription] = useState('');

  // Manual entry form
  const form = useForm<ManualEntryForm>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      reference: '',
      amount: 0,
      entity_name: '',
      description: '',
    },
  });

  // Handle manual entry submission
  const handleManualSubmit = async (data: ManualEntryForm) => {
    setIsSubmitting(true);
    try {
      await createBankTransaction({
        transaction_date: data.transaction_date,
        reference: data.reference || null,
        amount: data.amount,
        entity_name: data.entity_name || null,
        description: data.description || null,
      });

      toast.success('Bank transaction created successfully');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating bank transaction:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create bank transaction'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle CSV import submission
  const handleCsvImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await importBankStatement(selectedFile, batchDescription || undefined);

      toast.success(
        `Successfully imported ${result.imported_count} transaction(s)${
          result.skipped_count > 0 ? `, skipped ${result.skipped_count}` : ''
        }`
      );

      // Reset form
      setSelectedFile(null);
      setBatchDescription('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error importing bank statement:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to import bank statement'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Bank Transaction</DialogTitle>
          <DialogDescription>
            Add bank transactions manually or import from a CSV file
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'csv')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="csv">
              <Upload className="w-4 h-4 mr-2" />
              CSV Import
            </TabsTrigger>
          </TabsList>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="space-y-4">
            <form onSubmit={form.handleSubmit(handleManualSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transaction_date">
                    Transaction Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="transaction_date"
                    type="date"
                    {...form.register('transaction_date')}
                  />
                  {form.formState.errors.transaction_date && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.transaction_date.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Amount (ZAR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('amount', { valueAsNumber: true })}
                  />
                  {form.formState.errors.amount && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  placeholder="e.g., TRX12345"
                  {...form.register('reference')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_name">Entity Name</Label>
                <Input
                  id="entity_name"
                  placeholder="e.g., ABC Insurance Ltd"
                  {...form.register('entity_name')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Additional notes about this transaction"
                  rows={3}
                  {...form.register('description')}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Transaction
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* CSV Import Tab */}
          <TabsContent value="csv" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batch_description">Batch Description (Optional)</Label>
                <Input
                  id="batch_description"
                  placeholder="e.g., January 2024 Bank Statement"
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Helps identify this import batch in the system
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv_file">
                  CSV File <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="csv_file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                <h4 className="font-semibold text-sm mb-2">CSV Format Requirements</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Required columns: <code className="bg-white dark:bg-gray-800 px-1 rounded">date</code>, <code className="bg-white dark:bg-gray-800 px-1 rounded">amount</code></li>
                  <li>• Optional columns: <code className="bg-white dark:bg-gray-800 px-1 rounded">reference</code>, <code className="bg-white dark:bg-gray-800 px-1 rounded">entity_name</code>, <code className="bg-white dark:bg-gray-800 px-1 rounded">description</code></li>
                  <li>• Date format: YYYY-MM-DD</li>
                  <li>• Amount format: Numeric (e.g., 1234.56)</li>
                  <li>• First row should contain column headers</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCsvImport} disabled={isSubmitting || !selectedFile}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Import CSV
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
