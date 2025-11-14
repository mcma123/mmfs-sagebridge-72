import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  DollarSign,
  ArrowRightLeft,
  CheckCircle2,
  Upload,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getOutstandingItems,
  getBankTransactions,
  suggestMatches,
  applyMatch,
  OutstandingReceivable,
  BankTransaction,
  MatchSuggestion,
} from '@/lib/api/accounting';
import { MatchSuggestionCard } from '@/components/reconciliation/MatchSuggestionCard';
import { ImportPaymentDialog } from '@/components/banking/ImportPaymentDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PaymentReconciliation = () => {
  // State
  const [selectedPayment, setSelectedPayment] = useState<BankTransaction | null>(null);
  const [searchOutstanding, setSearchOutstanding] = useState('');
  const [searchPayment, setSearchPayment] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Map<number, number>>(new Map());

  const queryClient = useQueryClient();

  // Fetch outstanding items
  const {
    data: outstandingData,
    isLoading: isLoadingOutstanding,
    error: outstandingError,
  } = useQuery({
    queryKey: ['outstanding-items'],
    queryFn: getOutstandingItems,
  });

  // Fetch bank transactions
  const {
    data: bankTransactionsData,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: ['bank-transactions'],
    queryFn: getBankTransactions,
  });

  // Fetch match suggestions when a payment is selected
  const {
    data: suggestionsData,
    isLoading: isLoadingSuggestions,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['match-suggestions', selectedPayment?.id],
    queryFn: () => suggestMatches(selectedPayment!.id),
    enabled: !!selectedPayment,
  });

  // Apply match mutation
  const applyMatchMutation = useMutation({
    mutationFn: ({ bankTransactionId, allocations }: {
      bankTransactionId: number;
      allocations: Array<{ journal_id: number; amount: number }>
    }) => applyMatch(bankTransactionId, allocations),
    onSuccess: () => {
      toast.success('Payment allocation applied successfully');
      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ['outstanding-items'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      // Clear selection
      setSelectedPayment(null);
      setSelectedMatches(new Map());
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to apply payment allocation');
    },
  });

  // Filter outstanding items
  const filteredOutstanding = outstandingData?.items.filter((item) => {
    const matchesSearch =
      item.entity_name.toLowerCase().includes(searchOutstanding.toLowerCase()) ||
      (item.journal_reference?.toLowerCase().includes(searchOutstanding.toLowerCase()) ?? false);

    const matchesType = typeFilter === 'all' || item.journal_type === typeFilter;

    return matchesSearch && matchesType;
  }) ?? [];

  // Filter bank transactions
  const filteredTransactions = bankTransactionsData?.items.filter((transaction) => {
    return (
      transaction.reference?.toLowerCase().includes(searchPayment.toLowerCase()) ||
      transaction.entity_name?.toLowerCase().includes(searchPayment.toLowerCase()) ||
      transaction.amount.toString().includes(searchPayment)
    );
  }) ?? [];

  // Handle match selection
  const handleMatchSelect = (journalId: number, selected: boolean, amount?: number) => {
    const newMatches = new Map(selectedMatches);
    if (selected && amount !== undefined) {
      newMatches.set(journalId, amount);
    } else {
      newMatches.delete(journalId);
    }
    setSelectedMatches(newMatches);
  };

  // Handle apply matches
  const handleApplyMatches = () => {
    if (!selectedPayment || selectedMatches.size === 0) {
      toast.error('Please select at least one match');
      return;
    }

    const allocations = Array.from(selectedMatches.entries()).map(([journal_id, amount]) => ({
      journal_id,
      amount,
    }));

    // Validate total allocation doesn't exceed payment amount
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated > selectedPayment.amount) {
      toast.error('Total allocation exceeds payment amount');
      return;
    }

    applyMatchMutation.mutate({
      bankTransactionId: selectedPayment.id,
      allocations,
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get aging badge color
  const getAgingColor = (days: number) => {
    if (days > 60) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
    if (days > 30) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
    if (days > 15) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
    return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
  };

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payment Reconciliation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Match payments with outstanding items
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Payment
            </Button>
            <Button
              onClick={handleApplyMatches}
              disabled={!selectedPayment || selectedMatches.size === 0 || applyMatchMutation.isPending}
            >
              {applyMatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              Apply Matches ({selectedMatches.size})
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outstanding Items Panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                  Outstanding Items
                </CardTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {filteredOutstanding.length} items
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by entity or reference..."
                  value={searchOutstanding}
                  onChange={(e) => setSearchOutstanding(e.target.value)}
                  className="flex-1"
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="debit_note">Debit Notes</SelectItem>
                    <SelectItem value="invoice">Invoices</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingOutstanding ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : outstandingError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load outstanding items: {(outstandingError as Error).message}
                  </AlertDescription>
                </Alert>
              ) : filteredOutstanding.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">No outstanding items found</p>
                </div>
              ) : (
                filteredOutstanding.map((item) => (
                  <div
                    key={item.journal_id}
                    className="p-4 border rounded-lg transition-all hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{item.entity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.journal_reference || `Journal #${item.journal_id}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {item.journal_type || 'Receivable'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-amber-600">
                        {formatCurrency(item.outstanding_amount)}
                      </span>
                      <span className="text-muted-foreground">
                        Due: {formatDate(item.journal_date)}
                      </span>
                    </div>
                    {item.aging_days !== undefined && (
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getAgingColor(item.aging_days)}`}
                        >
                          {item.aging_days > 0
                            ? `${item.aging_days} days overdue`
                            : `Due in ${Math.abs(item.aging_days)} days`
                          }
                        </Badge>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Unallocated Payments Panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Unallocated Payments
                </CardTitle>
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                  {filteredTransactions.length} payments
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference or amount..."
                  value={searchPayment}
                  onChange={(e) => setSearchPayment(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingTransactions ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : transactionsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load bank transactions: {(transactionsError as Error).message}
                  </AlertDescription>
                </Alert>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">No unallocated payments found</p>
                </div>
              ) : (
                filteredTransactions.map((payment) => (
                  <div
                    key={payment.id}
                    onClick={() => setSelectedPayment(payment)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedPayment?.id === payment.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{payment.reference || 'No Reference'}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.entity_name || 'Unknown entity'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(payment.transaction_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                    {payment.description && (
                      <p className="text-xs text-muted-foreground mt-2">{payment.description}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Match Suggestions */}
        {selectedPayment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Match Suggestions for {selectedPayment.reference || `Transaction #${selectedPayment.id}`}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Payment Amount: {formatCurrency(selectedPayment.amount)} |
                Selected: {formatCurrency(Array.from(selectedMatches.values()).reduce((sum, a) => sum + a, 0))} |
                Remaining: {formatCurrency(
                  selectedPayment.amount - Array.from(selectedMatches.values()).reduce((sum, a) => sum + a, 0)
                )}
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingSuggestions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : !suggestionsData?.suggestions || suggestionsData.suggestions.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">No match suggestions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestionsData.suggestions.map((suggestion) => (
                    <MatchSuggestionCard
                      key={suggestion.journal_id}
                      suggestion={suggestion}
                      isSelected={selectedMatches.has(suggestion.journal_id)}
                      onSelect={(selected) =>
                        handleMatchSelect(
                          suggestion.journal_id,
                          selected,
                          suggestion.outstanding_amount
                        )
                      }
                      allocationAmount={selectedMatches.get(suggestion.journal_id)}
                      onAmountChange={(amount) =>
                        handleMatchSelect(suggestion.journal_id, true, amount)
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Import Payment Dialog */}
      <ImportPaymentDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
        }}
      />
    </MainLayout>
  );
};

export default PaymentReconciliation;
