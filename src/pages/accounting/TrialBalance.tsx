
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  FileDown,
  ChevronRight,
  ChevronDown,
  CalendarRange,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, sanitizeNumber } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, exportTrialBalance, type TrialBalanceDTO } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(Math.abs(value));
};

// Helper function to determine if an account type is a debit normal balance
const isDebitNormalBalance = (type: string): boolean => {
  const normalizedType = type.toLowerCase();
  return normalizedType.includes('asset') || normalizedType.includes('expense');
};

// Helper function to get category from account type
const getCategoryFromType = (type: string): string => {
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes('asset')) return 'Assets';
  if (normalizedType.includes('liabilit')) return 'Liabilities';
  if (normalizedType.includes('equity')) return 'Equity';
  if (normalizedType.includes('income') || normalizedType.includes('revenue')) return 'Income';
  if (normalizedType.includes('expense')) return 'Expenses';
  return 'Other';
};

const TrialBalance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const role = getPrimaryRole();

  const [asOfDate, setAsOfDate] = useState<Date | undefined>(new Date());
  const [openCategories, setOpenCategories] = useState<string[]>(['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses']);
  const [comparisonPeriod, setComparisonPeriod] = useState('none');
  const [isExporting, setIsExporting] = useState(false);

  // Handle comparison period changes
  const handleComparisonPeriodChange = (value: string) => {
    setComparisonPeriod(value);

    // Calculate and set the appropriate date based on comparison period
    const today = new Date();
    if (value === 'previousMonth') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 0); // Last day of previous month
      setAsOfDate(lastMonth);
    } else if (value === 'previousYear') {
      const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      setAsOfDate(lastYear);
    } else if (value === 'none') {
      setAsOfDate(new Date());
    }
    // For 'custom', keep the current asOfDate value (user will set via date picker)
  };

  // Fetch trial balance data from API
  const { data: trialBalanceData, isLoading, isError, error } = useQuery({
    queryKey: ['trial-balance', role, asOfDate?.toISOString().split('T')[0]],
    queryFn: () => getTrialBalance(
      { asOfDate: asOfDate?.toISOString().split('T')[0] },
      role
    ),
  });

  // Handle Excel export
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await exportTrialBalance(
        { asOfDate: asOfDate?.toISOString().split('T')[0] },
        role
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial-balance-${asOfDate?.toISOString().split('T')[0] || 'current'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: 'Trial balance has been exported to Excel',
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export trial balance',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Show error toast when query fails
  React.useEffect(() => {
    if (isError && error) {
      toast({
        title: 'Error loading trial balance',
        description: (error as any).message || 'Failed to load trial balance data',
        variant: 'destructive',
      });
    }
  }, [isError, error, toast]);

  // Transform flat trial balance data into categorized structure
  const { categories, grandTotalDebit, grandTotalCredit } = useMemo(() => {
    const items = trialBalanceData?.items || [];

    if (items.length === 0) {
      return {
        categories: [],
        grandTotalDebit: 0,
        grandTotalCredit: 0,
      };
    }

    // Group accounts by category
    const categoryMap: Record<string, {
      name: string;
      accounts: Array<{
        name: string;
        accountNumber: string;
        debit: number;
        credit: number;
        balance: number;
      }>;
      totalDebit: number;
      totalCredit: number;
    }> = {};

    let grandDebit = 0;
    let grandCredit = 0;

    items.forEach((item: TrialBalanceDTO) => {
      // Sanitize balance to a finite number to prevent NaN issues
      const balance = sanitizeNumber(item.balance);
      const category = getCategoryFromType(item.type);
      const isDebitNormal = isDebitNormalBalance(item.type);

      // Calculate debit and credit amounts based on balance and account type
      let debit = 0;
      let credit = 0;

      if (isDebitNormal) {
        // For debit normal balance accounts (Assets, Expenses)
        if (balance >= 0) {
          debit = balance;
        } else {
          credit = Math.abs(balance);
        }
      } else {
        // For credit normal balance accounts (Liabilities, Equity, Income)
        if (balance >= 0) {
          credit = balance;
        } else {
          debit = Math.abs(balance);
        }
      }

      // Initialize category if it doesn't exist
      if (!categoryMap[category]) {
        categoryMap[category] = {
          name: category,
          accounts: [],
          totalDebit: 0,
          totalCredit: 0,
        };
      }

      // Add account to category
      categoryMap[category].accounts.push({
        name: item.name,
        accountNumber: item.code,
        debit,
        credit,
        balance: balance,
      });

      // Update category totals (sanitize to ensure no NaN accumulation)
      categoryMap[category].totalDebit = sanitizeNumber(categoryMap[category].totalDebit + debit);
      categoryMap[category].totalCredit = sanitizeNumber(categoryMap[category].totalCredit + credit);

      // Update grand totals (sanitize to ensure no NaN accumulation)
      grandDebit = sanitizeNumber(grandDebit + debit);
      grandCredit = sanitizeNumber(grandCredit + credit);
    });

    // Convert map to array and sort categories
    const categoryOrder = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses', 'Other'];
    const categoriesArray = categoryOrder
      .map(name => categoryMap[name])
      .filter(Boolean);

    return {
      categories: categoriesArray,
      grandTotalDebit: grandDebit,
      grandTotalCredit: grandCredit,
    };
  }, [trialBalanceData]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };

  const isCollapsibleOpen = (category: string) => openCategories.includes(category);

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
            onClick={() => navigate('/accounting')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounting
          </Button>
        </div>
        
        {/* Header */}
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">Trial Balance</h1>
          <p className="text-white/80">View account balances at a specific date</p>
        </div>
        
        {/* Trial Balance Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Trial Balance Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex flex-wrap gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !asOfDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarRange className="mr-2 h-4 w-4" />
                      {asOfDate ? (
                        format(asOfDate, "MMMM dd, yyyy")
                      ) : (
                        <span>Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={asOfDate}
                      onSelect={setAsOfDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Select value={comparisonPeriod} onValueChange={handleComparisonPeriodChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Comparison" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Comparison</SelectItem>
                    <SelectItem value="previousMonth">Previous Month</SelectItem>
                    <SelectItem value="previousYear">Previous Year</SelectItem>
                    <SelectItem value="custom">Custom Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={handleExport}
                  disabled={isExporting || isLoading}
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown size={16} />
                      Export
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Trial Balance Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Trial Balance as of {asOfDate ? format(asOfDate, "MMMM dd, yyyy") : format(new Date(), "MMMM dd, yyyy")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Standard Trial Balance
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenCategories(openCategories.length === categories.length ? [] : categories.map(c => c.name))}>
              {openCategories.length === categories.length ? 'Collapse All' : 'Expand All'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage-lightGray">
                    <TableHead className="min-w-[300px]">Account</TableHead>
                    <TableHead className="w-[120px]">Account #</TableHead>
                    <TableHead className="text-right w-[150px]">Debit</TableHead>
                    <TableHead className="text-right w-[150px]">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-sage-blue" />
                          <span className="ml-3 text-muted-foreground">Loading trial balance...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <p className="text-destructive">Failed to load trial balance data</p>
                        <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
                      </TableCell>
                    </TableRow>
                  ) : categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {categories.map((category) => (
                        <React.Fragment key={category.name}>
                          <TableRow className="hover:bg-sage-lightGray cursor-pointer" onClick={() => toggleCategory(category.name)}>
                            <TableCell className="font-bold flex items-center">
                              {isCollapsibleOpen(category.name) ?
                                <ChevronDown size={16} className="mr-2" /> :
                                <ChevronRight size={16} className="mr-2" />
                              }
                              {category.name}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-medium font-mono">
                              {category.totalDebit > 0 ? formatCurrency(category.totalDebit) : ''}
                            </TableCell>
                            <TableCell className="text-right font-medium font-mono">
                              {category.totalCredit > 0 ? formatCurrency(category.totalCredit) : ''}
                            </TableCell>
                          </TableRow>
                          {isCollapsibleOpen(category.name) && category.accounts.map((account) => (
                            <TableRow key={`${category.name}-${account.accountNumber}`} className="bg-sage-lightGray/20">
                              <TableCell className="pl-8">{account.name}</TableCell>
                              <TableCell className="font-mono text-xs">{account.accountNumber}</TableCell>
                              <TableCell className="text-right font-mono">
                                {account.debit > 0 ? formatCurrency(account.debit) : ''}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {account.credit > 0 ? formatCurrency(account.credit) : ''}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}

                      {/* Grand Totals */}
                      <TableRow className="font-bold bg-sage-lightGray">
                        <TableCell colSpan={2}>Grand Totals</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(grandTotalDebit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(grandTotalCredit)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {!isLoading && !isError && categories.length > 0 && (
              <div className="mt-6 flex justify-between items-center p-4 bg-sage-lightGray/20 rounded-md">
                <div className="flex gap-10">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Debits</p>
                    <p className="text-lg font-medium">{formatCurrency(grandTotalDebit)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Credits</p>
                    <p className="text-lg font-medium">{formatCurrency(grandTotalCredit)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Difference</p>
                  <p className={cn(
                    "text-lg font-medium",
                    Math.abs(grandTotalDebit - grandTotalCredit) > 0.01 && "text-destructive"
                  )}>
                    {formatCurrency(Math.abs(grandTotalDebit - grandTotalCredit))}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Trial Balance Explanation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">About Trial Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p>
                The trial balance shows all the accounts in your general ledger and their balances as of a specific date.
                It provides a check that the total of all debit balances equals the total of all credit balances, ensuring
                that the books are in balance.
              </p>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-1">Types of Trial Balance:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="font-medium">Unadjusted Trial Balance</span> - Shows account balances before any
                    adjusting entries are made at the end of an accounting period.
                  </li>
                  <li>
                    <span className="font-medium">Adjusted Trial Balance</span> - Shows account balances after adjusting
                    entries have been made but before closing entries.
                  </li>
                  <li>
                    <span className="font-medium">Standard Trial Balance</span> - A general term that can refer to either
                    an unadjusted or adjusted trial balance, depending on when it's generated.
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default TrialBalance;
