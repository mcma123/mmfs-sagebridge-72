
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { getAccount, updateAccount, deleteAccount } from '@/lib/api/accounting';
import type { UpdateAccountRequest, AccountDTO } from '@/lib/api/accounting';

// Define the schema for account form
const accountFormSchema = z.object({
  accountName: z.string().min(3, { message: 'Account name must be at least 3 characters' }),
  accountNumber: z.string().min(1, { message: 'Account number is required' }),
  accountDescription: z.string().optional(),
  category: z.string().min(1, { message: 'Category is required' }),
  accountType: z.string().min(1, { message: 'Account type is required' }),
  currencyCode: z.string().default('ZAR'),
  isActive: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

// Helper to derive category from account type
const getCategoryFromType = (type: string): string => {
  const lowerType = type.toLowerCase();

  if (lowerType.includes('asset')) return 'Assets';
  if (lowerType.includes('liability') || lowerType.includes('liabilities')) return 'Liabilities';
  if (lowerType.includes('equity') || lowerType.includes('capital') || lowerType.includes('retained')) return 'Equity';
  if (lowerType.includes('revenue') || lowerType.includes('income')) return 'Income';
  if (lowerType.includes('expense') || lowerType.includes('cost')) return 'Expenses';

  return 'Assets'; // Default fallback
};

const EditAccount = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Define form with default values
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountName: '',
      accountNumber: '',
      accountDescription: '',
      category: '',
      accountType: '',
      currencyCode: 'ZAR',
      isActive: true,
    },
  });

  // Watch values for conditional rendering
  const accountCategory = form.watch('category');

  // Load account data
  useEffect(() => {
    const fetchAccount = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const accountData = await getAccount(Number(id), 'accountant');
        setAccount(accountData);

        // Populate form with existing data
        form.reset({
          accountName: accountData.name,
          accountNumber: accountData.code,
          accountDescription: '',
          category: getCategoryFromType(accountData.type),
          accountType: accountData.type,
          currencyCode: accountData.currency || 'ZAR',
          isActive: accountData.is_active ?? true,
        });
      } catch (error: any) {
        console.error('Error fetching account:', error);
        toast({
          title: 'Failed to load account',
          description: error.message || 'An error occurred while loading the account.',
          variant: 'destructive',
        });
        navigate('/accounting/chart-of-accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [id, navigate, form]);

  // Form submission handler
  const onSubmit = async (data: AccountFormValues) => {
    if (!id || !account) return;

    try {
      // Map form fields to API structure
      const payload: UpdateAccountRequest = {
        code: data.accountNumber,
        name: data.accountName,
        type: data.accountType,
        currency: data.currencyCode || null,
        is_active: data.isActive ?? true,
      };

      // Call API to update account
      await updateAccount(Number(id), payload, 'accountant');

      // Show success message
      toast({
        title: 'Account updated successfully',
        description: `${data.accountName} has been updated.`,
      });

      // Redirect to chart of accounts
      navigate('/accounting/chart-of-accounts');
    } catch (error: any) {
      console.error('Failed to update account:', error);

      // Show error message
      toast({
        title: 'Failed to update account',
        description: error.message || 'An error occurred while updating the account. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!id || !account) return;

    try {
      setDeleting(true);

      // Cascade delete: remove account and all its transactions
      await deleteAccount(Number(id), 'accountant', true);

      toast({
        title: 'Account deleted',
        description: `${account.code} - ${account.name} and all its transactions have been removed.`,
      });

      navigate('/accounting/chart-of-accounts');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast({
        title: 'Failed to delete account',
        description:
          error.message ||
          'An error occurred while deleting the account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-sage-blue" />
        </div>
      </MainLayout>
    );
  }

  if (!account) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <h2 className="text-2xl font-semibold">Account Not Found</h2>
          <Button onClick={() => navigate('/accounting/chart-of-accounts')}>
            Return to Chart of Accounts
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Back Button */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sage-blue hover:text-sage-blue/90 hover:bg-sage-blue/10 flex items-center gap-2 text-sm font-medium"
            onClick={() => navigate('/accounting/chart-of-accounts')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chart of Accounts
          </Button>
        </div>

        {/* Header */}
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">Edit Account</h1>
          <p className="text-white/80">Update the account details</p>
        </div>

        {/* Account Form */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Modify the account details below</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Unique identifier for this account
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Assets">Assets</SelectItem>
                            <SelectItem value="Liabilities">Liabilities</SelectItem>
                            <SelectItem value="Equity">Equity</SelectItem>
                            <SelectItem value="Income">Income</SelectItem>
                            <SelectItem value="Expenses">Expenses</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accountCategory === 'Assets' && (
                              <>
                                <SelectItem value="Current Assets">Current Assets</SelectItem>
                                <SelectItem value="Fixed Assets">Fixed Assets</SelectItem>
                                <SelectItem value="Investments">Investments</SelectItem>
                                <SelectItem value="Other Assets">Other Assets</SelectItem>
                              </>
                            )}
                            {accountCategory === 'Liabilities' && (
                              <>
                                <SelectItem value="Current Liabilities">Current Liabilities</SelectItem>
                                <SelectItem value="Non-current Liabilities">Non-current Liabilities</SelectItem>
                              </>
                            )}
                            {accountCategory === 'Equity' && (
                              <>
                                <SelectItem value="Capital">Capital</SelectItem>
                                <SelectItem value="Retained Earnings">Retained Earnings</SelectItem>
                              </>
                            )}
                            {accountCategory === 'Income' && (
                              <>
                                <SelectItem value="Operating Revenue">Operating Revenue</SelectItem>
                                <SelectItem value="Non-operating Revenue">Non-operating Revenue</SelectItem>
                              </>
                            )}
                            {accountCategory === 'Expenses' && (
                              <>
                                <SelectItem value="Cost of Sales">Cost of Sales</SelectItem>
                                <SelectItem value="Operating Expenses">Operating Expenses</SelectItem>
                                <SelectItem value="Non-operating Expenses">Non-operating Expenses</SelectItem>
                                <SelectItem value="Non-cash Expenses">Non-cash Expenses</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="accountDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter a description for this account"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="currencyCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ZAR">South African Rand (ZAR)</SelectItem>
                            <SelectItem value="USD">US Dollar (USD)</SelectItem>
                            <SelectItem value="EUR">Euro (EUR)</SelectItem>
                            <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Make this account available for transactions
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Form Actions */}
                <div className="flex justify-between gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/accounting/chart-of-accounts')}
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => setDeleteOpen(true)}
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                    <Button type="submit" disabled={deleting}>
                      Update Account
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account and all its transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete account{' '}
                <span className="font-mono font-semibold">
                  {account.code} - {account.name}
                </span>{' '}
                and remove all transactions (journal lines and ledger entries) linked to this account.
                Historical journals may become unbalanced after this action. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete account and transactions'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </MainLayout>
  );
};

export default EditAccount;
