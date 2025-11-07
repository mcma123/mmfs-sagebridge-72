import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Search, FilterX, AlertCircle, Info, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccounts, getTrialBalance, postJournal, type AccountDTO, type TrialBalanceDTO, type Role } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { sanitizeNumber } from '@/lib/utils';

type RowModel = {
  id: number;
  name: string;
  code: string;
  type: string;
  currentBalance: number;
  desiredBalance: number;
  delta: number;
};

const formatZAR = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(value);

const isDebitNormal = (type: string) => ['Asset', 'Expense'].includes(type);

const AdjustOpeningBalance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // RBAC role for API calls
  const role = (getPrimaryRole() as Role) || 'accountant';

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [openingDate, setOpeningDate] = useState<string>('2025-01-01');
  const [desiredMap, setDesiredMap] = useState<Record<number, number>>({});
  const [offsetAccountId, setOffsetAccountId] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // Queries
  const accountsQuery = useQuery({
    queryKey: ['accounts', role],
    queryFn: () => getAccounts(role),
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['trial-balance', role, openingDate],
    queryFn: () => getTrialBalance({ asOfDate: openingDate }, role),
    enabled: !!openingDate,
  });

  const accounts: AccountDTO[] = accountsQuery.data?.items ?? [];
  const tbItems: TrialBalanceDTO[] = trialBalanceQuery.data?.items ?? [];

  // Equity accounts for offset selector
  const equityAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'Equity'),
    [accounts]
  );

  // Map account_id -> current balance (as of date)
  const balanceByAccountId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of tbItems) {
      map[item.account_id] = sanitizeNumber(item.balance);
    }
    return map;
  }, [tbItems]);

  // Build table rows (desired defaults to current)
  const rows: RowModel[] = useMemo(() => {
    return accounts.map((a) => {
      const current = sanitizeNumber(balanceByAccountId[a.id] ?? 0);
      const desired = desiredMap[a.id] !== undefined ? sanitizeNumber(desiredMap[a.id]) : current;
      const delta = desired - current;
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        type: a.type,
        currentBalance: current,
        desiredBalance: desired,
        delta,
      };
    });
  }, [accounts, balanceByAccountId, desiredMap]);

  // Filters
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      const matchTerm = !term || r.name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term);
      const matchType = typeFilter === 'all' || r.type === typeFilter;
      return matchTerm && matchType;
    });
  }, [rows, searchTerm, typeFilter]);

  // Compute draft journal lines (without offset) and totals
  const draftLines = useMemo(() => {
    const lines: Array<{ account_id: number; date: string; debit: number; credit: number; memo?: string }> = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const r of rows) {
      const delta = sanitizeNumber(r.delta);
      if (Math.abs(delta) < 0.000001) continue;

      const debitNormal = isDebitNormal(r.type);
      let debit = 0;
      let credit = 0;
      if (debitNormal) {
        if (delta > 0) debit = delta;
        else credit = Math.abs(delta);
      } else {
        if (delta > 0) credit = delta;
        else debit = Math.abs(delta);
      }

      if (debit > 0 || credit > 0) {
        lines.push({
          account_id: r.id,
          date: openingDate,
          debit: Number(debit.toFixed(2)),
          credit: Number(credit.toFixed(2)),
          memo: 'Opening balance adjustment',
        });
        totalDebit += debit;
        totalCredit += credit;
      }
    }

    return {
      lines,
      totals: {
        debit: Number(totalDebit.toFixed(2)),
        credit: Number(totalCredit.toFixed(2)),
        diff: Number((totalDebit - totalCredit).toFixed(2)), // +ve => need credit on offset; -ve => need debit on offset
      },
    };
  }, [rows, openingDate]);

  const balancingNeeded = Math.abs(draftLines.totals.diff) >= 0.01;

  // Validation & posting enablement
  const canPost =
    !accountsQuery.isLoading &&
    !trialBalanceQuery.isLoading &&
    draftLines.lines.length > 0 &&
    offsetAccountId !== null; // require selection per spec (even if not strictly needed)

  async function handlePost() {
    if (!offsetAccountId) {
      toast({
        title: 'Offset account required',
        description: 'Please select an equity account as the offset before posting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsPosting(true);

      // Finalize lines with balancing line if needed
      const lines = [...draftLines.lines];

      const diff = draftLines.totals.diff;
      if (Math.abs(diff) >= 0.01) {
        // If diff > 0, we have more debits than credits -> need a credit on offset
        // If diff < 0, we have more credits than debits -> need a debit on offset
        const debit = diff < 0 ? Math.abs(diff) : 0;
        const credit = diff > 0 ? Math.abs(diff) : 0;
        lines.push({
          account_id: offsetAccountId,
          date: openingDate,
          debit: Number(debit.toFixed(2)),
          credit: Number(credit.toFixed(2)),
          memo: 'Opening balance offset',
        });
      }

      if (lines.length === 0) {
        toast({
          title: 'Nothing to post',
          description: 'All desired balances match current balances.',
        });
        return;
      }

      await postJournal(
        {
          date: openingDate,
          reference: 'OPENING',
          description: 'Opening balance adjustment',
          lines,
        },
        role
        // x-user-id not passed; backend defaults or uses provided header via api client default
      );

      // Refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trial-balance', role] }),
        queryClient.invalidateQueries({ queryKey: ['trial-balance', role, openingDate] }),
        queryClient.invalidateQueries({ queryKey: ['accounts', role] }),
      ]);

      // Reset desired for accounts we touched
      setDesiredMap({});
      toast({
        title: 'Opening balances adjusted',
        description: 'The adjustment journal has been posted successfully.',
      });
    } catch (e: any) {
      const msg = e?.message || 'Failed to post adjustment';
      toast({
        title: 'Failed to post',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  }

  const migrationMissing =
    !!trialBalanceQuery.error &&
    (String((trialBalanceQuery.error as any)?.message || '')
      .toLowerCase()
      .includes('trial balance function not found') ||
      String((trialBalanceQuery.error as any)?.message || '')
        .toLowerCase()
        .includes('migration_missing'));

  const loading = accountsQuery.isLoading || trialBalanceQuery.isLoading;
  const loadError = accountsQuery.error || trialBalanceQuery.error;

  return (
    <MainLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/accounting')} className="mb-4">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Accounting
          </Button>
        </div>

        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">Adjust Opening Balances</h1>
          <p className="text-white/80">Set or adjust the starting balances for your accounts</p>
        </div>

        <Alert className="bg-amber-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            Adjusting opening balances will create journal entries to reflect the changes. These changes affect historical
            financial reports. Ensure you select an equity offset account to keep the journal balanced.
          </AlertDescription>
        </Alert>

        {migrationMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Trial Balance Function Missing</AlertTitle>
            <AlertDescription>
              The database function accounting.fn_trial_balance_asof is not available. Please run database migration 012
              and ensure the Supabase API exposes the public schema, then reload this page.
            </AlertDescription>
          </Alert>
        )}

        {loadError && !loading && !migrationMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load data</AlertTitle>
            <AlertDescription>{String((loadError as any)?.message || 'Unknown error')}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Account Opening Balances</CardTitle>
            <CardDescription>Adjust balances as of a specific date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  className="w-full md:w-[260px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                    <FilterX className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Liability">Liability</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead className="text-right">Desired Opening Balance</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Loading accounts and balances...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No accounts match your criteria
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.code}</TableCell>
                        <TableCell className="text-right">{formatZAR(r.currentBalance)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-[150px] ml-auto text-right"
                            value={
                              desiredMap[r.id] !== undefined
                                ? String(desiredMap[r.id])
                                : String(Number(r.desiredBalance.toFixed(2)))
                            }
                            onChange={(e) => {
                              const v = sanitizeNumber(e.target.value);
                              setDesiredMap((prev) => ({ ...prev, [r.id]: v }));
                            }}
                          />
                        </TableCell>
                        <TableCell className={`text-right ${Math.abs(r.delta) > 0.009 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                          {formatZAR(r.delta)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Opening Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-sage-blue flex-shrink-0 mt-1" />
                <p>Opening balances represent the starting point for your accounts as of a specific date.</p>
              </div>
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-sage-blue flex-shrink-0 mt-1" />
                <p>Adjustments post as a single balanced journal on the selected opening date.</p>
              </div>
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-sage-blue flex-shrink-0 mt-1" />
                <p>You must select an Equity account to use as the offset so total debits equal total credits.</p>
              </div>
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-1" />
                <p>Changes affect historical financial reports. Proceed with caution.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opening Balance Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span>Total Debits (draft)</span>
                <span className="font-medium">{formatZAR(draftLines.totals.debit)}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span>Total Credits (draft)</span>
                <span className="font-medium">{formatZAR(draftLines.totals.credit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Difference</span>
                <span className={`font-medium ${Math.abs(draftLines.totals.diff) < 0.01 ? 'text-green-600' : 'text-amber-700'}`}>
                  {formatZAR(draftLines.totals.diff)}
                  {Math.abs(draftLines.totals.diff) < 0.01 ? (
                    <CheckCircle className="h-4 w-4 inline ml-1" />
                  ) : null}
                </span>
              </div>

              <div className="pt-2">
                <div className="text-sm text-muted-foreground mb-2">Offset Equity Account</div>
                <Select
                  value={offsetAccountId ? String(offsetAccountId) : ''}
                  onValueChange={(v) => setOffsetAccountId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select equity offset account" />
                  </SelectTrigger>
                  <SelectContent>
                    {equityAccounts.length === 0 ? (
                      <SelectItem value="0" disabled>
                        No equity accounts available
                      </SelectItem>
                    ) : (
                      equityAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {equityAccounts.length === 0 && (
                  <div className="text-xs text-amber-700 mt-2">
                    No equity accounts found. Create one in Chart of Accounts and return to select as offset.
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-sage-lightGray/30 flex justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">As of {openingDate}</span>
              </div>
              <Button
                size="sm"
                onClick={handlePost}
                disabled={!canPost || isPosting || equityAccounts.length === 0}
              >
                {isPosting ? 'Posting...' : 'Post Adjustment'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default AdjustOpeningBalance;
