
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { createAccount } from '@/lib/api/accounting';
import type { CreateAccountRequest } from '@/lib/api/accounting';

// Define the schema for account form
const accountFormSchema = z.object({
  accountName: z.string().min(3, { message: 'Account name must be at least 3 characters' }),
  accountNumber: z.string().min(1, { message: 'Account number is required' }),
  accountDescription: z.string().optional(),
  category: z.string().min(1, { message: 'Category is required' }),
  accountType: z.string().min(1, { message: 'Account type is required' }),
  subCategory: z.string().optional(),
  openingBalance: z.string().optional(),
  currencyCode: z.string().default('ZAR'),
  taxCode: z.string().optional(),
  isActive: z.boolean().default(true),
  isControlAccount: z.boolean().default(false),
  isSystemAccount: z.boolean().default(false),
  
  // Bank account details (optional)
  bankDetails: z.object({
    isBankAccount: z.boolean().default(false),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    branchCode: z.string().optional(),
    accountHolder: z.string().optional(),
  }),
  
  // Advanced settings
  allowManualJournals: z.boolean().default(true),
  allowReconciliation: z.boolean().default(true),
  reportingGroup: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

const AddAccount = () => {
  const navigate = useNavigate();
  
  // Define form with default values
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountName: '',
      accountNumber: '',
      accountDescription: '',
      category: '',
      accountType: '',
      subCategory: '',
      openingBalance: '0.00',
      currencyCode: 'ZAR',
      taxCode: '',
      isActive: true,
      isControlAccount: false,
      isSystemAccount: false,
      bankDetails: {
        isBankAccount: false,
        bankName: '',
        accountNumber: '',
        branchCode: '',
        accountHolder: '',
      },
      allowManualJournals: true,
      allowReconciliation: true,
      reportingGroup: '',
    },
  });
  
  // Watch values for conditional rendering
  const accountCategory = form.watch('category');
  const isBankAccount = form.watch('bankDetails.isBankAccount');
  
  // Form submission handler
  const onSubmit = async (data: AccountFormValues) => {
    try {
      // Map form fields to API structure
      const payload: CreateAccountRequest = {
        code: data.accountNumber,
        name: data.accountName,
        type: data.accountType,
        currency: data.currencyCode || null,
        parent_id: null, // Can be extended later for hierarchical accounts
        is_active: data.isActive ?? true,
      };

      // Call API to create account
      await createAccount(payload, 'accountant');

      // Show success message
      toast({
        title: 'Account created successfully',
        description: `${data.accountName} has been added to your chart of accounts.`,
      });

      // Redirect to chart of accounts
      navigate('/accounting/chart-of-accounts');
    } catch (error: any) {
      console.error('Failed to create account:', error);

      // Show error message
      toast({
        title: 'Failed to create account',
        description: error.message || 'An error occurred while creating the account. Please try again.',
        variant: 'destructive',
      });
    }
  };

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
          <h1 className="text-2xl font-semibold text-white mb-2">Add New Account</h1>
          <p className="text-white/80">Create a new account in your chart of accounts</p>
        </div>
        
        {/* Account Form */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Enter the details of the new account</CardDescription>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="openingBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Balance</FormLabel>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-gray-500">R</span>
                          </div>
                          <FormControl>
                            <Input placeholder="0.00" className="pl-8" {...field} />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Initial balance when creating the account
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="currencyCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    name="taxCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Code</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select tax code (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="STD">Standard Rate (15%)</SelectItem>
                            <SelectItem value="ZERO">Zero Rated (0%)</SelectItem>
                            <SelectItem value="EX">Exempt</SelectItem>
                            <SelectItem value="NONTAX">Non-taxable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default tax code for this account (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  
                  <FormField
                    control={form.control}
                    name="isControlAccount"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <FormLabel className="text-base">Control Account</FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle size={14} className="text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Control accounts summarize subsidiary ledgers</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <FormDescription>
                            Account that controls a subsidiary ledger
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
                  
                  <FormField
                    control={form.control}
                    name="bankDetails.isBankAccount"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Bank Account</FormLabel>
                          <FormDescription>
                            This account represents a physical bank account
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
                
                {/* Bank Account Details Section (conditional) */}
                {isBankAccount && (
                  <div className="space-y-6 border rounded-lg p-6 bg-gray-50">
                    <h3 className="text-lg font-medium">Bank Account Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="bankDetails.bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter bank name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bankDetails.accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Account Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter account number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bankDetails.branchCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch Code</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter branch code" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bankDetails.accountHolder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Holder</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter account holder name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                
                {/* Advanced Settings */}
                <Separator />
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Advanced Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="allowManualJournals"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Allow Manual Journals</FormLabel>
                            <FormDescription>
                              Allow manual journal entries for this account
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
                    
                    <FormField
                      control={form.control}
                      name="allowReconciliation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Allow Reconciliation</FormLabel>
                            <FormDescription>
                              Enable account reconciliation
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
                  
                  <FormField
                    control={form.control}
                    name="reportingGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reporting Group</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select reporting group (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="operating">Operating</SelectItem>
                            <SelectItem value="financing">Financing</SelectItem>
                            <SelectItem value="investing">Investing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          For grouping in financial reports (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Form Actions */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/accounting/chart-of-accounts')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save Account</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default AddAccount;
