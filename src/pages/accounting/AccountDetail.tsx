import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Edit,
  FileDown,
  CalendarRange,
  CheckCircle2,
  XCircle,
  Loader2
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getAccount, AccountDTO } from '@/lib/api/accounting';
import { toast } from 'sonner';

type LedgerEntry = {
  id: number;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance_after: number;
  reconciled?: boolean;
};

const AccountDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<AccountDTO | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    const fetchAccountData = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch account details
        const accountData = await getAccount(Number(id));
        setAccount(accountData);

        // TODO: Fetch ledger entries from /api/v1/accounting/ledger?account_id=${id}
        // For now, using mock data
        setLedgerEntries([
          {
            id: 1,
            date: '2024-01-15',
            reference: 'JE-001',
            description: 'Opening Balance',
            debit: 50000,
            credit: 0,
            balance_after: 50000,
            reconciled: true
          },
          {
            id: 2,
            date: '2024-01-20',
            reference: 'INV-1001',
            description: 'Client Premium Payment',
            debit: 15000,
            credit: 0,
            balance_after: 65000,
            reconciled: true
          },
          {
            id: 3,
            date: '2024-01-25',
            reference: 'PAY-501',
            description: 'Reinsurance Premium Payment',
            debit: 0,
            credit: 25000,
            balance_after: 40000,
            reconciled: false
          }
        ]);
      } catch (error: any) {
        console.error('Error fetching account:', error);

        // Check if it's a 404 error
        if (error.message && error.message.includes('404')) {
          toast.error('Account not found');
        } else {
          toast.error(`Failed to load account: ${error.message || 'Unknown error'}`);
        }

        // Don't navigate away, let the user see the error
        setAccount(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [id, navigate]);

  // Filter ledger entries by date range
  const filteredEntries = ledgerEntries.filter(entry => {
    if (!dateRange.from) return true;

    const entryDate = new Date(entry.date);

    if (dateRange.to) {
      return entryDate >= dateRange.from && entryDate <= dateRange.to;
    }

    return entryDate.toDateString() === dateRange.from.toDateString();
  });

  // Calculate totals
  const totalDebits = filteredEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredits = filteredEntries.reduce((sum, entry) => sum + entry.credit, 0);
  const currentBalance = filteredEntries.length > 0
    ? filteredEntries[filteredEntries.length - 1].balance_after
    : 0;

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
          <XCircle className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-semibold">Account Not Found</h2>
          <p className="text-muted-foreground text-center max-w-md">
            The account with ID <span className="font-mono font-bold">{id}</span> could not be found.
            It may have been deleted or you may not have permission to view it.
          </p>
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

        {/* Account Header */}
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold text-white">
                  {account.code} - {account.name}
                </h1>
                <Badge variant={account.is_active ? "default" : "secondary"} className="bg-white/20 text-white">
                  {account.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-white/80 text-sm">Account Type: {account.type}</p>
              {account.currency && (
                <p className="text-white/80 text-sm">Currency: {account.currency}</p>
              )}
            </div>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => navigate(`/accounting/account/${id}/edit`)}
            >
              <Edit className="h-4 w-4" />
              Edit Account
            </Button>
          </div>
        </div>

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-sage-blue/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
              <p className="text-2xl font-semibold">
                R{currentBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-sage-blue/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Debits</p>
              <p className="text-2xl font-semibold text-green-600">
                R{totalDebits.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-sage-blue/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Credits</p>
              <p className="text-2xl font-semibold text-red-600">
                R{totalCredits.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Entries */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Ledger Entries</CardTitle>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
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
                        <span>Filter by Date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                    <div className="flex items-center justify-between p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                      >
                        Clear
                      </Button>
                      <Button size="sm" onClick={() => document.body.click()}>
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" className="gap-1">
                  <FileDown size={16} />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage-lightGray">
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[120px]">Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[130px]">Debit</TableHead>
                    <TableHead className="text-right w-[130px]">Credit</TableHead>
                    <TableHead className="text-right w-[140px]">Balance</TableHead>
                    <TableHead className="w-[80px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        No ledger entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.debit > 0
                            ? `R${entry.debit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.credit > 0
                            ? `R${entry.credit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          R{entry.balance_after.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.reconciled ? (
                            <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          ) : (
                            <XCircle size={16} className="text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default AccountDetail;
