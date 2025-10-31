import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getJournals, getJournal, voidJournal, type JournalDTO, type JournalLineDTO } from '@/lib/api/accounting';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getRolesFromToken } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';

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
};

const DebitCreditNotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [journals, setJournals] = useState<JournalDTO[]>([]);
  const [selected, setSelected] = useState<{ journal: JournalDTO; lines: JournalLineDTO[] } | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<{ id: number; ref: string } | null>(null);
  const roles = getRolesFromToken();
  const canVoid = roles.includes('admin') || roles.includes('accountant');

  useEffect(() => {
    (async () => {
      try {
        const resp = await getJournals();
        setJournals(resp.items || []);
      } catch (err) {
        // silently ignore for now; in a fuller UX, surface a toast
        console.error('Failed to load journals', err);
      }
    })();
  }, []);

  function parseAmountFromDescription(desc?: string | null): { currency?: string; amount?: number; reason?: string; policyRef?: string; entityName?: string } {
    if (!desc) return {};
    const m = desc.match(/NetDue(?:ToYou)?\s+([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)/);
    const pm = desc.match(/Policy\s+([^;]+)/);
    const em = desc.match(/Entity\s+([^;]+)/);
    return {
      currency: m?.[1],
      amount: m?.[2] ? Number(m[2]) : undefined,
      policyRef: pm?.[1]?.trim(),
      entityName: em?.[1]?.trim(),
      reason: desc.split(';')[0],
    };
  }

  const debitNotes: NoteRow[] = useMemo(() => {
    return (journals || [])
      // Hide voided journals from the list to reflect deletion semantics
      .filter(j => !j.voided_at)
      .filter(j => (j.reference || '').startsWith('DN-'))
      .map(j => {
        const { amount, currency, reason, policyRef, entityName } = parseAmountFromDescription(j.description);
        return {
          id: j.reference || `DN-${j.id}`,
          journalId: j.id,
          date: j.date,
          entityType: '-',
          entityName: entityName || '-',
          policyRef: policyRef || '-',
          reason: reason || 'Debit Note',
          amount,
          currency,
          status: j.voided_at ? 'Voided' : 'Posted',
        };
      });
  }, [journals]);

  const creditNotes: NoteRow[] = useMemo(() => {
    return (journals || [])
      // Hide voided journals from the list to reflect deletion semantics
      .filter(j => !j.voided_at)
      .filter(j => (j.reference || '').startsWith('CN-'))
      .map(j => {
        const { amount, currency, reason, policyRef, entityName } = parseAmountFromDescription(j.description);
        return {
          id: j.reference || `CN-${j.id}`,
          journalId: j.id,
          date: j.date,
          entityType: '-',
          entityName: entityName || '-',
          policyRef: policyRef || '-',
          reason: reason || 'Credit Note',
          amount,
          currency,
          status: j.voided_at ? 'Voided' : 'Posted',
        };
      });
  }, [journals]);

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
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debitNotes.map(note => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.id}</TableCell>
                        <TableCell>{note.date}</TableCell>
                        <TableCell>{note.entityType}</TableCell>
                        <TableCell>{note.entityName}</TableCell>
                        <TableCell>{note.policyRef}</TableCell>
                        <TableCell>{note.reason}</TableCell>
                        <TableCell className="text-red-600">
                          {note.currency || '-'} {typeof note.amount === 'number' ? note.amount.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              note.status === 'Applied' 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-blue-50 text-blue-700'
                            }
                          >
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              // Open the modal immediately with a lightweight placeholder
                              setSelected({
                                journal: { id: note.journalId, date: note.date, reference: note.id, description: 'Loading…' },
                                lines: [],
                              });
                              try {
                                const resp = await getJournal(note.journalId);
                                setSelected(resp);
                              } catch (err: any) {
                                console.error('Failed to load journal', err);
                                toast({ title: 'Could not load', description: 'Failed to fetch journal details.', variant: 'destructive' });
                                setSelected(null);
                              }
                            }}
                          >
                            View
                          </Button>
                          {canVoid && note.status !== 'Voided' && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmVoidId({ id: note.journalId, ref: note.id })}>Void</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map(note => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.id}</TableCell>
                        <TableCell>{note.date}</TableCell>
                        <TableCell>{note.entityType}</TableCell>
                        <TableCell>{note.entityName}</TableCell>
                        <TableCell>{note.policyRef}</TableCell>
                        <TableCell>{note.reason}</TableCell>
                        <TableCell className="text-green-600">
                          {note.currency || '-'} {typeof note.amount === 'number' ? note.amount.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              note.status === 'Applied' 
                                ? 'bg-green-50 text-green-700' 
                                : note.status === 'Draft'
                                ? 'bg-gray-50 text-gray-700'
                                : 'bg-blue-50 text-blue-700'
                            }
                          >
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const resp = await getJournal(note.journalId);
                                setSelected(resp);
                              } catch (err) {
                                console.error('Failed to load journal', err);
                              }
                            }}
                          >
                            View
                          </Button>
                          {canVoid && note.status !== 'Voided' && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmVoidId({ id: note.journalId, ref: note.id })}>Void</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
      {/* View Journal Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.journal?.reference || `Journal #${selected?.journal?.id}`}</DialogTitle>
            <DialogDescription>
              {selected?.journal?.date} • {selected?.journal?.description || '-'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selected?.lines || []).map(l => (
                  <TableRow key={l.id}>
                    <TableCell>#{l.account_id}</TableCell>
                    <TableCell>{l.entity_id ? `#${l.entity_id}` : '-'}</TableCell>
                    <TableCell>{l.date}</TableCell>
                    <TableCell className="text-green-600">{Number(l.debit || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">{Number(l.credit || 0).toLocaleString()}</TableCell>
                    <TableCell>{l.memo || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

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
                    const resp = await getJournals();
                    setJournals(resp.items || []);
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
    </MainLayout>
  );
};

export default DebitCreditNotes;
