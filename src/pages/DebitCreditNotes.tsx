import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText, TrendingUp, TrendingDown, MoreVertical, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getJournals, getAccounts, voidJournal, type JournalDTO, type AccountDTO } from '@/lib/api/accounting';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getRolesFromToken } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';
import { MarkPaidDialog } from '@/components/notes/MarkPaidDialog';
import { PartialPaymentDialog } from '@/components/notes/PartialPaymentDialog';
import { ReconcilePaymentDialog } from '@/components/notes/ReconcilePaymentDialog';
import { ApplyCreditDialog } from '@/components/notes/ApplyCreditDialog';
import { RefundPaidDialog } from '@/components/notes/RefundPaidDialog';
import { DeleteConfirmDialog } from '@/components/notes/DeleteConfirmDialog';
import { toast as sonnerToast } from 'sonner';

type NoteRow = {
  id: string; // display id (DN- / CN-)
  journalId: number;
  date: string;
  entityType: string;
  entityName: string;
  policyRef: string;
  reason: string;
  amount?: number;
  currency?: string;
  status: string;
  paymentStatus?: string;
  paidAmount?: number;
  /**
   * Remaining amount that can still be settled for debit notes (amount - paidAmount).
   */
  remainingAmount?: number;
  /**
   * For credit notes, the remaining amount that can still be applied.
   */
  availableAmount?: number;
};

const DebitCreditNotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [journals, setJournals] = useState<JournalDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);

  const [confirmVoidId, setConfirmVoidId] = useState<{ id: number; ref: string } | null>(null);

  // Action dialog states
  const [markPaidDialog, setMarkPaidDialog] = useState<{ open: boolean; journalId?: number; reference?: string; amount?: number }>({ open: false });
  const [partialPaymentDialog, setPartialPaymentDialog] = useState<{ open: boolean; journalId?: number; reference?: string; amount?: number; paidAmount?: number }>({ open: false });
  const [reconcileDialog, setReconcileDialog] = useState<{ open: boolean; journalId?: number; reference?: string }>({ open: false });
  const [applyCreditDialog, setApplyCreditDialog] = useState<{ open: boolean; creditNoteId?: number; reference?: string; amount?: number }>({ open: false });
  const [refundPaidDialog, setRefundPaidDialog] = useState<{ open: boolean; journalId?: number; reference?: string; amount?: number }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; journalId?: number; reference?: string; noteType?: 'debit' | 'credit' }>({ open: false });

  const roles = getRolesFromToken();
  const canVoid = roles.includes('admin') || roles.includes('accountant');
  const canDelete = roles.includes('admin');
  const canManagePayments = roles.includes('admin') || roles.includes('accountant');
  const userId = 1; // TODO: Get from auth context

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [journalsResp, accountsResp] = await Promise.all([
        getJournals(),
        getAccounts(),
      ]);
      setJournals(journalsResp.items || []);
      setAccounts(accountsResp.items || []);
    } catch (err) {
      console.error('Failed to load data', err);
      sonnerToast.error('Failed to load data');
    }
  };

  // Get bank accounts (Asset type accounts for payment)
  const bankAccounts = useMemo(() => {
    return accounts.filter(a => a.type === 'Asset' && a.is_active !== false);
  }, [accounts]);

  // Get unpaid debit notes for credit application
  const unpaidDebitNotes = useMemo(() => {
    return journals.filter(j =>
      j.reference?.startsWith('DN-') &&
      !j.voided_at &&
      (j.payment_status === 'unpaid' || j.payment_status === 'partial')
    );
  }, [journals]);

  function parseAmountFromDescription(desc?: string | null): {
    currency?: string;
    amount?: number;
    reason?: string;
    policyRef?: string;
    entityName?: string;
  } {
    if (!desc) return {};

    // Match patterns like:
    //   NetDue USD 1719.71
    //   NetDueToYou ZAR 4,950.00
    // allowing optional thousands separators.
    const m = desc.match(/NetDue(?:ToYou)?\s+([A-Z]{3})\s+([0-9,]+(?:\.[0-9]+)?)/);
    const pm = desc.match(/Policy\s+([^;]+)/);
    const em = desc.match(/Entity\s+([^;]+)/);

    const rawAmount = m?.[2]?.replace(/,/g, '');
    const parsedAmount = rawAmount && !isNaN(Number(rawAmount)) ? Number(rawAmount) : undefined;

    return {
      currency: m?.[1],
      amount: parsedAmount,
      policyRef: pm?.[1]?.trim(),
      entityName: em?.[1]?.trim(),
      reason: desc.split(';')[0],
    };
  }

  function getPaymentStatusBadge(paymentStatus?: string) {
    switch (paymentStatus) {
      case 'paid':
        // Fully settled (including reconciled items mapped to "Paid" in the grid logic below)
        return <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>;
      case 'partial':
        // Partially paid but not yet fully settled
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Partially Paid</Badge>;
      case 'reconciled':
        // Reconciled is effectively a fully paid note; surface as "Paid" for the user
        return <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>;
      case 'unpaid':
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Unpaid</Badge>;
    }
  }

  const debitNotes: NoteRow[] = useMemo(() => {
    return (journals || [])
      .filter(j => !j.voided_at)
      .filter(j => (j.reference || '').startsWith('DN-'))
      .map(j => {
        const { amount, currency, reason, policyRef, entityName } = parseAmountFromDescription(j.description);
        const totalAmount = typeof amount === 'number' ? amount : 0;
        const paidAmount = j.paid_amount || 0;
        const remainingAmount = Math.max(0, totalAmount - paidAmount);

        return {
          id: j.reference || `DN-${j.id}`,
          journalId: j.id,
          date: j.date,
          entityType: '-',
          entityName: entityName || '-',
          policyRef: policyRef || '-',
          reason: reason || 'Debit Note',
          amount: totalAmount,
          currency,
          status: j.voided_at ? 'Voided' : 'Posted',
          paymentStatus: j.payment_status || 'unpaid',
          paidAmount,
          remainingAmount,
        };
      });
  }, [journals]);

  const creditNotes: NoteRow[] = useMemo(() => {
    return (journals || [])
      .filter(j => !j.voided_at)
      .filter(j => (j.reference || '').startsWith('CN-'))
      .map(j => {
        const { amount, currency, reason, policyRef, entityName } = parseAmountFromDescription(j.description);
        const totalAmount = typeof amount === 'number' ? amount : 0;
        const paidAmount = j.paid_amount || 0;
        const availableAmount = Math.max(0, totalAmount - paidAmount);

        return {
          id: j.reference || `CN-${j.id}`,
          journalId: j.id,
          date: j.date,
          entityType: '-',
          entityName: entityName || '-',
          policyRef: policyRef || '-',
          reason: reason || 'Credit Note',
          amount: totalAmount,
          currency,
          status: j.voided_at ? 'Voided' : 'Posted',
          paymentStatus: j.payment_status || 'unpaid',
          paidAmount,
          availableAmount,
        };
      });
  }, [journals]);

  const handleExportPDF = (journalId: number, reference: string) => {
    const type = reference.startsWith('DN-') ? 'debit' : 'credit';
    const url = `/notes/${type}/${journalId}?print=true`;
    window.open(url, '_blank');
  };

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Debit & Credit Notes</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/notes/debit/new')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              New Debit Note
            </Button>
            <Button onClick={() => navigate('/notes/credit/new')}>
              <TrendingDown className="h-4 w-4 mr-2" />
              New Credit Note
            </Button>
          </div>
        </div>

        <Tabs defaultValue="debit" className="w-full">
          <TabsList>
            <TabsTrigger value="debit">
              <TrendingUp className="h-4 w-4 mr-2" />
              Debit Notes
            </TabsTrigger>
            <TabsTrigger value="credit">
              <TrendingDown className="h-4 w-4 mr-2" />
              Credit Notes
            </TabsTrigger>
          </TabsList>

          {/* Debit Notes Tab */}
          <TabsContent value="debit" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Debit Notes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search debit notes..."
                      className="w-[250px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debitNotes.map(note => {
                      const effectiveRemaining =
                        note.remainingAmount ??
                        Math.max(0, (note.amount || 0) - (note.paidAmount || 0));
                      const canAddCreditNoteToDebit =
                        (note.paymentStatus === 'unpaid' || note.paymentStatus === 'partial') &&
                        effectiveRemaining > 0;

                      return (
                        <TableRow key={note.journalId}>
                          <TableCell className="font-medium">{note.id}</TableCell>
                          <TableCell>{note.date}</TableCell>
                          <TableCell>{note.entityName}</TableCell>
                          <TableCell>{note.policyRef}</TableCell>
                          <TableCell>{note.reason}</TableCell>
                          <TableCell className="text-red-600">
                            {note.currency || 'R'} {typeof note.amount === 'number' ? note.amount.toLocaleString() : '-'}
                            {note.paidAmount > 0 && (
                              <div className="text-xs text-green-600 mt-0.5">
                                Paid: R{note.paidAmount.toFixed(2)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(note.paymentStatus)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/notes/debit/${note.journalId}`)}
                              >
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canManagePayments && note.paymentStatus !== 'paid' && note.paymentStatus !== 'reconciled' && (
                                    <>
                                      <DropdownMenuItem onClick={() => setMarkPaidDialog({ open: true, journalId: note.journalId, reference: note.id, amount: note.amount })}>
                                        Mark as Paid
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setPartialPaymentDialog({ open: true, journalId: note.journalId, reference: note.id, amount: note.amount, paidAmount: note.paidAmount })}>
                                        Record Partial Payment
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canManagePayments && (note.paymentStatus === 'paid' || note.paymentStatus === 'partial') && (
                                    <DropdownMenuItem onClick={() => setReconcileDialog({ open: true, journalId: note.journalId, reference: note.id })}>
                                      Reconcile Payment
                                    </DropdownMenuItem>
                                  )}
                                  {note.paymentStatus === 'unpaid' || note.paymentStatus === 'partial' ? (
                                    <DropdownMenuItem onClick={() => navigate(`/payment-reconciliation?search=${note.id}`)}>
                                      View in Reconciliation
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canAddCreditNoteToDebit && (
                                    <DropdownMenuItem onClick={() => navigate(`/notes/credit/new?debitId=${note.journalId}`)}>
                                      Add Credit Note to Debit
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleExportPDF(note.journalId, note.id)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Export PDF
                                  </DropdownMenuItem>
                                  {canVoid && note.status !== 'Voided' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setConfirmVoidId({ id: note.journalId, ref: note.id })} className="text-orange-600">
                                        Void
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canDelete && note.paymentStatus === 'unpaid' && (
                                    <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, journalId: note.journalId, reference: note.id, noteType: 'debit' })} className="text-red-600">
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Credit Notes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search credit notes..."
                      className="w-[250px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map(note => {
                      const availableAmount = Math.max(0, (note.amount || 0) - (note.paidAmount || 0));

                      return (
                        <TableRow key={note.journalId}>
                          <TableCell className="font-medium">{note.id}</TableCell>
                          <TableCell>{note.date}</TableCell>
                          <TableCell>{note.entityName}</TableCell>
                          <TableCell>{note.policyRef}</TableCell>
                          <TableCell>{note.reason}</TableCell>
                          <TableCell className="text-green-600">
                            {note.currency || 'R'}{' '}
                            {typeof note.amount === 'number' ? note.amount.toLocaleString() : '-'}
                            {note.paidAmount > 0 && (
                              <div className="text-xs text-blue-600 mt-0.5">
                                Applied: R{note.paidAmount.toFixed(2)}
                              </div>
                            )}
                            {availableAmount > 0 && (
                              <div className="text-xs text-emerald-600 mt-0.5">
                                Available: R{availableAmount.toFixed(2)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(note.paymentStatus)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/notes/credit/${note.journalId}`)}
                              >
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canManagePayments &&
                                    note.paymentStatus !== 'paid' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setApplyCreditDialog({
                                            open: true,
                                            creditNoteId: note.journalId,
                                            reference: note.id,
                                            // Prefer remaining available amount; fall back to total if not computed
                                            amount: availableAmount > 0 ? availableAmount : note.amount || 0,
                                          })
                                        }
                                      >
                                        Apply Credit to Debit Note
                                      </DropdownMenuItem>
                                    )}
                                  <DropdownMenuItem onClick={() => handleExportPDF(note.journalId, note.id)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Export PDF
                                  </DropdownMenuItem>
                                  {canVoid && note.status !== 'Voided' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setConfirmVoidId({ id: note.journalId, ref: note.id })}
                                        className="text-orange-600"
                                      >
                                        Void
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canDelete && note.paymentStatus === 'unpaid' && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setDeleteDialog({
                                          open: true,
                                          journalId: note.journalId,
                                          reference: note.id,
                                          noteType: 'credit',
                                        })
                                      }
                                      className="text-red-600"
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>



      {/* Confirm Void */}
      <AlertDialog open={!!confirmVoidId} onOpenChange={(open) => !open && setConfirmVoidId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this note?</AlertDialogTitle>
            <AlertDialogDescription>
              Voiding will post a full reversal and mark the original as voided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmVoidId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmVoidId) {
                  try {
                    await voidJournal(confirmVoidId.id, `Void ${confirmVoidId.ref}`);
                    toast({ title: 'Note voided', description: `${confirmVoidId.ref} has been voided.` });
                    setConfirmVoidId(null);
                    loadData();
                  } catch (err) {
                    console.error('Failed to void journal', err);
                    toast({ title: 'Void failed', description: 'Could not void the selected note.', variant: 'destructive' });
                  }
                }
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Dialogs */}
      {markPaidDialog.journalId && (
        <MarkPaidDialog
          open={markPaidDialog.open}
          onOpenChange={(open) => setMarkPaidDialog({ open })}
          journalId={markPaidDialog.journalId}
          journalReference={markPaidDialog.reference || ''}
          totalAmount={markPaidDialog.amount || 0}
          bankAccounts={bankAccounts}
          onSuccess={loadData}
          userRole={roles[0] as any}
          userId={userId}
        />
      )}

      {partialPaymentDialog.journalId && (
        <PartialPaymentDialog
          open={partialPaymentDialog.open}
          onOpenChange={(open) => setPartialPaymentDialog({ open })}
          journalId={partialPaymentDialog.journalId}
          journalReference={partialPaymentDialog.reference || ''}
          totalAmount={partialPaymentDialog.amount || 0}
          paidAmount={partialPaymentDialog.paidAmount || 0}
          bankAccounts={bankAccounts}
          onSuccess={loadData}
          userRole={roles[0] as any}
          userId={userId}
        />
      )}

      {reconcileDialog.journalId && (
        <ReconcilePaymentDialog
          open={reconcileDialog.open}
          onOpenChange={(open) => setReconcileDialog({ open })}
          journalId={reconcileDialog.journalId}
          journalReference={reconcileDialog.reference || ''}
          onSuccess={loadData}
          userRole={roles[0] as any}
          userId={userId}
        />
      )}

      {applyCreditDialog.creditNoteId && (
        <ApplyCreditDialog
          open={applyCreditDialog.open}
          onOpenChange={(open) => setApplyCreditDialog({ open })}
          creditNoteId={applyCreditDialog.creditNoteId}
          creditNoteReference={applyCreditDialog.reference || ''}
          creditNoteAmount={applyCreditDialog.amount || 0}
          debitNotes={unpaidDebitNotes}
          onSuccess={loadData}
          userRole={roles[0] as any}
          userId={userId}
        />
      )}

      {refundPaidDialog.journalId && (
        <RefundPaidDialog
          open={refundPaidDialog.open}
          onOpenChange={(open) => setRefundPaidDialog({ open })}
          journalId={refundPaidDialog.journalId}
          journalReference={refundPaidDialog.reference || ''}
          totalAmount={refundPaidDialog.amount || 0}
          bankAccounts={bankAccounts}
          onSuccess={loadData}
          userRole={roles[0] as any}
          userId={userId}
        />
      )}

      {deleteDialog.journalId && (
        <DeleteConfirmDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open })}
          journalId={deleteDialog.journalId}
          journalReference={deleteDialog.reference || ''}
          noteType={deleteDialog.noteType || 'debit'}
          onSuccess={loadData}
          userRole={roles[0] as any}
        />
      )}
    </MainLayout>
  );
};

export default DebitCreditNotes;
