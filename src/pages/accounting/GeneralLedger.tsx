
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Search,
  FileDown,
  Filter,
  CalendarRange,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getLedger, getAccounts, type LedgerEntryDTO, type AccountDTO } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';

const GeneralLedger = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const role = getPrimaryRole();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Fetch accounts for filter dropdown
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', role],
    queryFn: () => getAccounts(role),
    onError: (error: any) => {
      toast({
        title: 'Error loading accounts',
        description: error.message || 'Failed to load accounts',
        variant: 'destructive',
      });
    },
  });

  // Fetch ledger entries with filters and pagination
  const { data: ledgerData, isLoading: ledgerLoading, isError: ledgerError } = useQuery({
    queryKey: ['ledger', selectedAccountId, dateRange.from, dateRange.to, page, pageSize, role],
    queryFn: () => getLedger({
      accountId: selectedAccountId ? Number(selectedAccountId) : undefined,
      start: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      end: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      limit: pageSize,
      offset: page * pageSize,
    }, role),
    keepPreviousData: true,
    onError: (error: any) => {
      toast({
        title: 'Error loading ledger',
        description: error.message || 'Failed to load ledger entries',
        variant: 'destructive',
      });
    },
  });

  const accounts = accountsData?.items || [];
  const ledgerEntries = ledgerData?.items || [];
  const totalEntries = ledgerData?.total || 0;
  const totalPages = Math.ceil(totalEntries / pageSize);

  // Create account lookup map for display
  const accountMap = useMemo(() => {
    const map: Record<number, AccountDTO> = {};
    accounts.forEach(acc => {
      map[acc.id] = acc;
    });
    return map;
  }, [accounts]);

  // Client-side search filter (applied after server-side pagination)
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return ledgerEntries;
    const term = searchTerm.toLowerCase();
    return ledgerEntries.filter(entry => {
      const account = accountMap[entry.account_id];
      const accountName = account ? `${account.code} - ${account.name}` : '';
      return accountName.toLowerCase().includes(term) ||
             entry.date.toLowerCase().includes(term);
    });
  }, [ledgerEntries, searchTerm, accountMap]);

  // Calculate totals for displayed entries
  const totals = useMemo(() => {
    const totalDebit = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.debit || '0'), 0);
    const totalCredit = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.credit || '0'), 0);
    const netChange = totalDebit - totalCredit;
    return { totalDebit, totalCredit, netChange };
  }, [filteredEntries]);

  // Format currency
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(num);
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
            onClick={() => navigate('/accounting')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounting
          </Button>
        </div>
        
        {/* Header */}
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">General Ledger</h1>
          <p className="text-white/80">View and analyze all financial transactions</p>
        </div>
        
        {/* General Ledger Content */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <Select 
                  value={selectedAccountId} 
                  onValueChange={(val) => {
                    setSelectedAccountId(val === 'all' ? '' : val);
                    setPage(0); // Reset to first page on filter change
                  }}
                  disabled={accountsLoading}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarRange className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>All Dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range || { from: undefined, to: undefined });
                        setPage(0); // Reset to first page on filter change
                      }}
                      numberOfMonths={2}
                    />
                    <div className="flex items-center justify-between p-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined });
                          setPage(0);
                        }}
                      >
                        Clear
                      </Button>
                      <Button size="sm" onClick={() => document.body.click()}>
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1 whitespace-nowrap">
                  <FileDown size={16} />
                  Export
                </Button>
              </div>
            </div>
            
            {/* Transactions Table */}
            {ledgerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-sage-blue" />
                <span className="ml-3 text-muted-foreground">Loading ledger entries...</span>
              </div>
            ) : ledgerError ? (
              <div className="text-center py-12">
                <p className="text-destructive">Failed to load ledger entries</p>
                <p className="text-sm text-muted-foreground mt-2">Please try again or contact support</p>
              </div>
            ) : (
              <>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sage-lightGray">
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[200px]">Account</TableHead>
                        <TableHead className="w-[120px]">Journal Line</TableHead>
                        <TableHead className="text-right w-[140px]">Debit</TableHead>
                        <TableHead className="text-right w-[140px]">Credit</TableHead>
                        <TableHead className="text-right w-[160px]">Running Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'No entries match your search' : 'No ledger entries found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEntries.map(entry => {
                          const account = accountMap[entry.account_id];
                          const debitValue = parseFloat(entry.debit || '0');
                          const creditValue = parseFloat(entry.credit || '0');
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {format(new Date(entry.date), 'MMM dd, yyyy')}
                              </TableCell>
                              <TableCell className="font-medium">
                                {account ? `${account.code} - ${account.name}` : `Account ${entry.account_id}`}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                #{entry.journal_line_id}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {debitValue > 0 ? formatCurrency(debitValue) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {creditValue > 0 ? formatCurrency(creditValue) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {formatCurrency(entry.balance_after)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalEntries)} of {totalEntries} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || ledgerLoading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        Page {page + 1} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1 || ledgerLoading}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Ledger Totals */}
            {!ledgerLoading && !ledgerError && filteredEntries.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-sage-blue/20">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Debits</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.totalDebit)}</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border border-sage-blue/20">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Credits</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.totalCredit)}</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border border-sage-blue/20">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Change</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        totals.netChange > 0 ? "text-green-600" : totals.netChange < 0 ? "text-red-600" : ""
                      )}>
                        {formatCurrency(totals.netChange)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default GeneralLedger;
