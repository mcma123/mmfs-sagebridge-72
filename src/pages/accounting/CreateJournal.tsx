
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Calendar,
  FileText,
  ClipboardList,
  Repeat,
  Save,
  Send
} from 'lucide-react';
import { 
  getAccounts, 
  createJournalDraft, 
  postJournal
} from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Define the schema for journal entry
const journalLineSchema = z.object({
  account: z.string().min(1, { message: 'Account is required' }),
  description: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  taxCode: z.string().optional(),
});

const journalFormSchema = z.object({
  date: z.date(),
  reference: z.string().min(1, { message: 'Reference is required' }),
  description: z.string().min(1, { message: 'Description is required' }),
  lines: z.array(journalLineSchema).min(2, { message: 'At least 2 journal lines are required' }),
  attachFile: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  
  // Recurring journal fields (optional)
  recurring: z.object({
    frequency: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    occurrences: z.string().optional(),
  }).optional(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

// Tax codes
const taxCodes = [
  { value: "STD", label: "Standard Rate (15%)" },
  { value: "ZERO", label: "Zero Rated (0%)" },
  { value: "EX", label: "Exempt" },
  { value: "NONTAX", label: "Non-taxable" },
];

const CreateJournal = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'standard' | 'recurring'>('standard');
  const role = getPrimaryRole();
  
  // Fetch accounts from database
  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(role as any),
  });
  
  const accounts = (accountsData?.items || []).map(acc => ({
    value: String(acc.id),
    label: `${acc.code} - ${acc.name}`,
    id: acc.id
  }));
  
  // Mutations for creating journal drafts and posting
  const draftMutation = useMutation({
    mutationFn: (payload: any) => createJournalDraft(payload, role as any, 1),
    onSuccess: () => {
      toast({
        title: 'Draft saved',
        description: 'Journal entry has been saved as a draft.',
      });
      navigate('/accounting/journals');
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving draft',
        description: error.message || 'Failed to save journal draft',
        variant: 'destructive',
      });
    }
  });
  
  const postMutation = useMutation({
    mutationFn: (payload: any) => postJournal(payload, role as any, 1),
    onSuccess: () => {
      toast({
        title: 'Journal posted',
        description: 'Journal entry has been posted to the ledger.',
      });
      navigate('/accounting/journals');
    },
    onError: (error: any) => {
      toast({
        title: 'Error posting journal',
        description: error.message || 'Failed to post journal entry',
        variant: 'destructive',
      });
    }
  });
  
  // Form definition
  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      date: new Date(),
      reference: `JE-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      lines: [
        { account: '', description: '', debit: '', credit: '', taxCode: '' },
        { account: '', description: '', debit: '', credit: '', taxCode: '' },
      ],
      attachFile: false,
      isRecurring: false,
      recurring: {
        frequency: 'monthly',
        startDate: new Date(),
        endDate: undefined,
        occurrences: '12',
      },
    },
  });
  
  // Use field array for journal lines
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  
  // Watch isRecurring value
  const isRecurring = form.watch('isRecurring');
  
  // Calculate totals for debits and credits
  const calculateTotals = () => {
    const lines = form.getValues('lines');
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    lines.forEach(line => {
      if (line.debit) {
        const debitValue = parseFloat(line.debit.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(debitValue)) {
          totalDebit += debitValue;
        }
      }
      if (line.credit) {
        const creditValue = parseFloat(line.credit.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(creditValue)) {
          totalCredit += creditValue;
        }
      }
    });
    
    return {
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
    };
  };
  
  const totals = calculateTotals();
  
  const onSubmit = (data: JournalFormValues) => {
    // Validate debits equal credits for posting
    if (!totals.isBalanced) {
      toast({
        title: 'Journal not balanced',
        description: 'Total debits must equal total credits.',
        variant: 'destructive',
      });
      return;
    }
    
    // Transform form data to API payload
    const payload = {
      date: format(data.date, 'yyyy-MM-dd'),
      reference: data.reference,
      description: data.description,
      lines: data.lines.map(line => {
        const debitValue = line.debit ? parseFloat(line.debit.replace(/[^0-9.-]+/g, '')) : 0;
        const creditValue = line.credit ? parseFloat(line.credit.replace(/[^0-9.-]+/g, '')) : 0;
        
        return {
          account_id: parseInt(line.account),
          date: format(data.date, 'yyyy-MM-dd'),
          debit: debitValue,
          credit: creditValue,
          memo: line.description || null,
          entity_id: null,
        };
      }).filter(line => line.debit > 0 || line.credit > 0), // Only include lines with amounts
    };
    
    // Post journal (immediate posting to ledger)
    postMutation.mutate(payload);
  };
  
  const onSaveDraft = () => {
    const data = form.getValues();
    
    // Transform form data to API payload (allow unbalanced for drafts)
    const payload = {
      date: format(data.date, 'yyyy-MM-dd'),
      reference: data.reference || `JE-DRAFT-${Date.now()}`,
      description: data.description || 'Draft journal entry',
      lines: data.lines.map(line => {
        const debitValue = line.debit ? parseFloat(line.debit.replace(/[^0-9.-]+/g, '')) : 0;
        const creditValue = line.credit ? parseFloat(line.credit.replace(/[^0-9.-]+/g, '')) : 0;
        
        return {
          account_id: parseInt(line.account),
          date: format(data.date, 'yyyy-MM-dd'),
          debit: debitValue,
          credit: creditValue,
          memo: line.description || null,
          entity_id: null,
        };
      }).filter(line => line.account && (line.debit || line.credit)), // Include lines with account and some amount
    };
    
    if (payload.lines.length === 0) {
      toast({
        title: 'Cannot save empty draft',
        description: 'Add at least one journal line with an account and amount.',
        variant: 'destructive',
      });
      return;
    }
    
    // Save as draft
    draftMutation.mutate(payload);
  };
  
  const addLine = () => {
    append({ account: '', description: '', debit: '', credit: '', taxCode: '' });
  };

  if (loadingAccounts) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading accounts...</p>
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
            onClick={() => navigate('/accounting/journals')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Journal Entries
          </Button>
        </div>
        
        {/* Header */}
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">Create Journal Entry</h1>
          <p className="text-white/80">Record a new accounting transaction</p>
        </div>
        
        {/* Journal Entry Form */}
        <Tabs defaultValue="standard" onValueChange={(v) => setActiveTab(v as 'standard' | 'recurring')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="standard">Standard Journal</TabsTrigger>
            <TabsTrigger value="recurring">Recurring Journal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Journal Information</CardTitle>
                    <CardDescription>Enter the details for this journal entry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
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
                      
                      <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>A unique identifier for this entry</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="isRecurring"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Recurring Journal</FormLabel>
                              <FormDescription>
                                This journal will repeat periodically
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
                    
                    <div className="mt-6">
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter a description of this journal entry"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                {isRecurring && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recurring Options</CardTitle>
                      <CardDescription>Configure how this journal entry repeats</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField
                          control={form.control}
                          name="recurring.frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="annually">Annually</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="recurring.startDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Start Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a start date</span>
                                      )}
                                      <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
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
                        
                        <FormField
                          control={form.control}
                          name="recurring.occurrences"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Occurrences</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormDescription>How many times this journal will repeat</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Journal Lines</CardTitle>
                      <CardDescription>Enter the accounts and amounts for this journal entry</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                      <Plus size={16} />
                      Add Line
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-sage-lightGray">
                          <tr>
                            <th className="py-3 px-4 text-left">Account</th>
                            <th className="py-3 px-4 text-left">Description</th>
                            <th className="py-3 px-4 text-right">Debit</th>
                            <th className="py-3 px-4 text-right">Credit</th>
                            <th className="py-3 px-4 text-left">Tax Code</th>
                            <th className="py-3 px-4 text-center w-[80px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field, index) => (
                            <tr key={field.id} className="border-t">
                              <td className="py-2 px-4">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.account`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="w-[200px] border-none">
                                            <SelectValue placeholder="Select account" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {accounts.map(account => (
                                            <SelectItem key={account.value} value={account.value}>
                                              {account.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="py-2 px-4">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          placeholder="Line description"
                                          className="border-none"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="py-2 px-4">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.debit`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <div className="relative">
                                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <span className="text-gray-500">R</span>
                                          </div>
                                          <Input 
                                            {...field} 
                                            placeholder="0.00"
                                            className="text-right border-none pl-8"
                                            onChange={(e) => {
                                              field.onChange(e);
                                              // Clear credit when debit is entered
                                              if (e.target.value) {
                                                form.setValue(`lines.${index}.credit`, '');
                                              }
                                            }}
                                          />
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="py-2 px-4">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.credit`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <div className="relative">
                                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <span className="text-gray-500">R</span>
                                          </div>
                                          <Input 
                                            {...field} 
                                            placeholder="0.00"
                                            className="text-right border-none pl-8"
                                            onChange={(e) => {
                                              field.onChange(e);
                                              // Clear debit when credit is entered
                                              if (e.target.value) {
                                                form.setValue(`lines.${index}.debit`, '');
                                              }
                                            }}
                                          />
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="py-2 px-4">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.taxCode`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="w-[180px] border-none">
                                            <SelectValue placeholder="Select tax code" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {taxCodes.map(code => (
                                            <SelectItem key={code.value} value={code.value}>
                                              {code.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="py-2 px-4 text-center">
                                {fields.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Totals row */}
                          <tr className="bg-sage-lightGray font-medium">
                            <td colSpan={2} className="py-2 px-4">Totals</td>
                            <td className="py-2 px-4 text-right">R{totals.totalDebit}</td>
                            <td className="py-2 px-4 text-right">R{totals.totalCredit}</td>
                            <td colSpan={2}></td>
                          </tr>
                          
                          {/* Difference row */}
                          <tr className={cn("font-medium", totals.isBalanced ? "bg-green-50" : "bg-red-50")}>
                            <td colSpan={2} className="py-2 px-4">Difference</td>
                            <td colSpan={2} className={cn("py-2 px-4 text-right", totals.isBalanced ? "text-green-600" : "text-red-600")}>
                              {totals.isBalanced ? "Balanced" : `R${Math.abs(parseFloat(totals.totalDebit) - parseFloat(totals.totalCredit)).toFixed(2)}`}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addLine}
                        className="gap-1"
                      >
                        <Plus size={16} />
                        Add Line
                      </Button>
                    </div>
                    
                    <Separator className="my-6" />
                    
                    <div>
                      <FormField
                        control={form.control}
                        name="attachFile"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                              <FormLabel>Attach Supporting Document</FormLabel>
                              <FormDescription>
                                Upload a file to document this transaction
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
                    
                    {form.watch('attachFile') && (
                      <div className="mt-4">
                        <Input type="file" />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/accounting/journals')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1"
                    onClick={onSaveDraft}
                    disabled={draftMutation.isPending || loadingAccounts}
                  >
                    <Save size={16} />
                    {draftMutation.isPending ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!totals.isBalanced || postMutation.isPending || loadingAccounts}
                    className="gap-1"
                  >
                    <Send size={16} />
                    {postMutation.isPending ? 'Posting...' : 'Create Journal'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="recurring" className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Same form but with isRecurring set to true */}
                <Card>
                  <CardContent className="pt-6 flex items-center justify-center flex-col gap-4">
                    <Repeat className="h-16 w-16 text-sage-blue" />
                    <h3 className="text-xl font-medium text-center">Recurring Journal Entry</h3>
                    <p className="text-center max-w-md text-muted-foreground">
                      Recurring journal entries repeat automatically at specified intervals.
                      This helps automate regular transactions like rent, depreciation, or subscriptions.
                    </p>
                    
                    <div className="flex gap-4 mt-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          form.setValue('isRecurring', true);
                          setActiveTab('standard');
                        }}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Setup Recurring Journal
                      </Button>
                      <Button 
                        type="button"
                        className="gap-1"
                        onClick={() => {
                          setActiveTab('standard');
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        Create Standard Journal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MainLayout>
  );
};

export default CreateJournal;
