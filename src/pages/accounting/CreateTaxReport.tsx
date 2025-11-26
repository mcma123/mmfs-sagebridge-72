import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2, AlertCircle, Info } from 'lucide-react';
import { format, addDays, startOfQuarter, endOfQuarter } from 'date-fns';
import { toast } from 'sonner';

import {
  getUpcomingTaxReturns,
  getTaxLiabilities,
  createTaxReturn,
  updateTaxReturn,
  type CreateTaxReturnRequest,
  type UpcomingTaxReturnDTO,
  type TaxLiabilityDTO,
} from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';

// Form validation schema
const createTaxReturnSchema = z.object({
  type: z.enum(['VAT', 'Employee_Tax', 'Provisional_Tax', 'Income_Tax']),
  period_start: z.date({
    required_error: 'Period start date is required',
  }),
  period_end: z.date({
    required_error: 'Period end date is required',
  }),
  due_date: z.date({
    required_error: 'Due date is required',
  }),
}).refine((data) => data.period_end >= data.period_start, {
  message: 'Period end must be after period start',
  path: ['period_end'],
});

type FormValues = z.infer<typeof createTaxReturnSchema>;

type LineItem = {
  id: string;
  description: string;
  account_id: number | null;
  amount: number;
};

const CreateTaxReport = () => {
  const navigate = useNavigate();
  const role = getPrimaryRole();
  const userId = Number(localStorage.getItem('user_id')) || 1;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [newLineDescription, setNewLineDescription] = useState('');
  const [newLineAccount, setNewLineAccount] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(createTaxReturnSchema),
    defaultValues: {
      type: 'VAT',
      period_start: startOfQuarter(new Date()),
      period_end: endOfQuarter(new Date()),
      due_date: addDays(endOfQuarter(new Date()), 25),
    },
  });

  const selectedType = form.watch('type');
  const periodStart = form.watch('period_start');
  const periodEnd = form.watch('period_end');

  // Fetch upcoming suggestions
  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-tax-returns', role],
    queryFn: () => getUpcomingTaxReturns(role),
  });

  const upcomingReturns = upcomingData?.items || [];

  // Fetch tax liabilities for preview
  const { data: liabilitiesData, refetch: refetchLiabilities } = useQuery({
    queryKey: ['tax-liabilities', role],
    queryFn: () => getTaxLiabilities(role),
    enabled: false, // Only fetch when preview is requested
  });

  const liabilities = liabilitiesData?.items || [];

  // Calculate preview when dates change
  useEffect(() => {
    if (selectedType === 'VAT' && periodStart && periodEnd && showPreview) {
      refetchLiabilities();
    }
  }, [selectedType, periodStart, periodEnd, showPreview, refetchLiabilities]);

  // Auto-populate line items from liabilities
  useEffect(() => {
    if (showPreview && selectedType === 'VAT' && liabilities.length > 0) {
      const autoLines: LineItem[] = liabilities.map((liability, idx) => ({
        id: `auto-${idx}`,
        description: `${liability.name} (${liability.code})`,
        account_id: liability.account_id,
        amount: parseFloat(liability.amount),
      }));

      // Merge calculated VAT lines with any existing manual lines
      setLineItems((prev) => {
        const manualLines = prev.filter((line) => !line.id.startsWith('auto-'));
        return [...autoLines, ...manualLines];
      });
    }
  }, [liabilities, showPreview, selectedType]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTaxReturnRequest & { lines?: any[] }) => {
      // 1. Create the base tax return
      const newReport = await createTaxReturn(data, role, userId);

      // 2. If we have lines, immediately update the report with them
      // This is a workaround because the create endpoint might not be processing lines correctly
      if (data.lines && data.lines.length > 0) {
        const totalAmount = data.lines.reduce((sum, line) => sum + line.amount, 0);

        await updateTaxReturn(newReport.id, {
          amount: totalAmount,
          lines: data.lines
        }, role);
      }

      return newReport;
    },
    onSuccess: (response) => {
      toast.success('Tax return created successfully');
      // Navigate to detail page
      const taxReturnId = response.id;
      navigate(`/accounting/tax-reports/${taxReturnId}`);
    },
    onError: (error: any) => {
      let description = error?.message || 'Please try again';

      // Surface a clearer message for invalid manual Account IDs
      if (typeof error?.message === 'string' && error.message.includes('INVALID_ACCOUNT_ID')) {
        description =
          'One or more line items use an Account ID that does not exist. ' +
          'Please check the Account ID values against your Chart of Accounts.';
      }

      toast.error('Failed to create tax return', {
        description,
      });
    },
  });

  // Add line item
  const handleAddLine = () => {
    if (!newLineDescription || !newLineAmount) {
      toast.error('Please fill in all line item fields');
      return;
    }

    const amount = parseFloat(newLineAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Amount must be a valid non-zero number');
      return;
    }

    let accountId: number | null = null;
    if (newLineAccount && newLineAccount.trim() !== '') {
      const parsed = Number(newLineAccount);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        toast.error('Account ID must be a positive whole number');
        return;
      }
      accountId = parsed;
    }

    const newLine: LineItem = {
      id: `manual-${Date.now()}`,
      description: newLineDescription,
      account_id: accountId,
      amount,
    };

    setLineItems([...lineItems, newLine]);
    setNewLineDescription('');
    setNewLineAccount('');
    setNewLineAmount('');
    toast.success('Line item added');
  };

  // Remove line item
  const handleRemoveLine = (id: string) => {
    setLineItems(lineItems.filter((line) => line.id !== id));
    toast.success('Line item removed');
  };

  // Calculate total amount
  const calculateTotal = () => {
    return lineItems.reduce((sum, line) => sum + line.amount, 0);
  };

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    // Check for pending line item details
    const finalLineItems = [...lineItems];

    // If user has typed something in the add line inputs
    if (newLineDescription || newLineAmount || newLineAccount) {
      if (!newLineDescription || !newLineAmount) {
        toast.error('Please complete the line item or clear the fields before saving');
        return;
      }

      const amount = parseFloat(newLineAmount);
      if (isNaN(amount) || amount === 0) {
        toast.error('Amount must be a valid non-zero number');
        return;
      }

      let accountId: number | null = null;
      if (newLineAccount && newLineAccount.trim() !== '') {
        const parsed = Number(newLineAccount);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          toast.error('Account ID must be a positive whole number');
          return;
        }
        accountId = parsed;
      }

      finalLineItems.push({
        id: `manual-pending-${Date.now()}`,
        description: newLineDescription,
        account_id: accountId,
        amount,
      });
    }

    const payload: CreateTaxReturnRequest & { lines?: any[] } = {
      type: data.type,
      period_start: format(data.period_start, 'yyyy-MM-dd'),
      period_end: format(data.period_end, 'yyyy-MM-dd'),
      due_date: format(data.due_date, 'yyyy-MM-dd'),
    };

    // Include manual line items if any were added/modified
    if (finalLineItems.length > 0) {
      payload.lines = finalLineItems.map((line) => ({
        description: line.description,
        account_id: line.account_id,
        amount: line.amount,
      }));
    }

    createMutation.mutate(payload);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: UpcomingTaxReturnDTO) => {
    form.setValue('type', suggestion.type as any);
    form.setValue('period_start', new Date(suggestion.period_start));
    form.setValue('period_end', new Date(suggestion.period_end));
    form.setValue('due_date', new Date(suggestion.due_date));
    setShowPreview(false);
    setLineItems([]);
    toast.success('Suggestion applied');
  };

  // Helper functions
  const formatDate = (date: Date) => {
    try {
      return format(date, 'dd MMM yyyy');
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(num);
  };

  const getTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      VAT: 'Value Added Tax (VAT)',
      Employee_Tax: 'Employee Tax (PAYE)',
      Provisional_Tax: 'Provisional Tax',
      Income_Tax: 'Income Tax',
    };
    return typeMap[type] || type;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/accounting/tax-reports')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Generate Tax Report</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a new tax return with automatic calculation or manual entry
            </p>
          </div>
        </div>

        {/* Upcoming Suggestions */}
        {upcomingReturns.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Upcoming Tax Returns</AlertTitle>
            <AlertDescription>
              <p className="mb-3">Select from suggested upcoming tax returns:</p>
              <div className="space-y-2">
                {upcomingReturns.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-background border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{getTypeName(suggestion.type)}</p>
                      <p className="text-sm text-muted-foreground">
                        Period: {formatDate(new Date(suggestion.period_start))} - {formatDate(new Date(suggestion.period_end))}
                        {' '} | Due: {formatDate(new Date(suggestion.due_date))}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        Suggested Amount: {formatCurrency(suggestion.suggested_amount)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      Use This
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Return Details</CardTitle>
            <CardDescription>
              Enter the basic information for the tax return
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Type Selection */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Return Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="VAT">Value Added Tax (VAT)</SelectItem>
                          <SelectItem value="Employee_Tax">Employee Tax (PAYE)</SelectItem>
                          <SelectItem value="Provisional_Tax">Provisional Tax</SelectItem>
                          <SelectItem value="Income_Tax">Income Tax</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the type of tax return to generate
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Period Start */}
                  <FormField
                    control={form.control}
                    name="period_start"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Period Start</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? formatDate(field.value) : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date('1900-01-01')
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Period End */}
                  <FormField
                    control={form.control}
                    name="period_end"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Period End</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? formatDate(field.value) : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date('1900-01-01')
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Due Date */}
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? formatDate(field.value) : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Preview Button */}
                {selectedType === 'VAT' && periodStart && periodEnd && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowPreview(true)}
                    >
                      Show Calculated Preview
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      Preview calculated VAT amounts based on current ledger balances
                    </p>
                  </div>
                )}

                <Separator />

                {/* Line Items Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Line Items</h3>
                    <p className="text-sm text-muted-foreground">
                      {showPreview && lineItems.length > 0
                        ? 'Review and modify calculated line items, or add manual entries'
                        : 'Add manual line items (optional) or use automatic calculation'}
                    </p>
                  </div>

                  {/* Line Items Table */}
                  {lineItems.length > 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Account ID</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{line.description}</TableCell>
                                <TableCell>{line.account_id || '-'}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(line.amount)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLine(line.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={2} className="font-bold">
                                Total
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(calculateTotal())}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Add Line Item Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Add Line Item</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <Label htmlFor="line-description">Description</Label>
                          <Input
                            id="line-description"
                            value={newLineDescription}
                            onChange={(e) => setNewLineDescription(e.target.value)}
                            placeholder="e.g., Output VAT"
                          />
                        </div>
                        <div>
                          <Label htmlFor="line-account">Account ID (Optional)</Label>
                          <Input
                            id="line-account"
                            type="number"
                            value={newLineAccount}
                            onChange={(e) => setNewLineAccount(e.target.value)}
                            placeholder="e.g., 2100"
                          />
                        </div>
                        <div>
                          <Label htmlFor="line-amount">Amount (ZAR)</Label>
                          <Input
                            id="line-amount"
                            type="number"
                            step="0.01"
                            value={newLineAmount}
                            onChange={(e) => setNewLineAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4"
                        onClick={handleAddLine}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Line Item
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Form Actions */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isLoading}
                  >
                    {createMutation.isLoading ? 'Creating...' : 'Save as Draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/accounting/tax-reports')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default CreateTaxReport;
