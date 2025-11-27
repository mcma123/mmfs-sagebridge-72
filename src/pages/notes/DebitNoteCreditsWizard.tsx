import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import {
    getDebitCreditSummary,
    finalizeDebitIncome,
    getJournal,
    getAccounts,
    type DebitCreditSummaryResponse,
    type JournalDTO,
    type AccountDTO,
} from '@/lib/api/accounting';
import { getAccountingDefaults, saveAccountingDefaults } from '@/lib/store/accountingSettings';

const DebitNoteCreditsWizard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const debitNoteId = Number(id);

    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [journal, setJournal] = useState<JournalDTO | null>(null);
    const [summary, setSummary] = useState<DebitCreditSummaryResponse | null>(null);
    const [accounts, setAccounts] = useState<AccountDTO[]>([]);

    const defaults = getAccountingDefaults();
    const [mmfsIncomeAccountId, setMmfsIncomeAccountId] = useState<number | null>(
        defaults.mmfsIncomeAccountId ?? null
    );
    const [balancingAccountId, setBalancingAccountId] = useState<number | null>(
        defaults.mmfsIncomeBalancingAccountId ?? null
    );

    const loadAll = async () => {
        try {
            setLoading(true);

            const [journalResp, summaryResp, accountsResp] = await Promise.all([
                getJournal(debitNoteId),
                getDebitCreditSummary(debitNoteId),
                getAccounts(),
            ]);

            setJournal(journalResp.journal);
            setSummary(summaryResp);
            setAccounts(accountsResp.items || []);
        } catch (error: any) {
            console.error('Failed to load debit note credits summary', error);
            toast({
                title: 'Failed to load debit note',
                description: error?.message || 'Could not load debit/credit summary.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!debitNoteId) {
            toast({
                title: 'Invalid debit note',
                description: 'Missing or invalid debit note id in URL.',
                variant: 'destructive',
            });
            navigate('/debit-credit-notes');
            return;
        }

        void loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debitNoteId]);

    const handleSaveDefaults = (next: {
        mmfsIncomeAccountId?: number | null;
        mmfsIncomeBalancingAccountId?: number | null;
    }) => {
        const merged = {
            ...defaults,
            mmfsIncomeAccountId:
                next.mmfsIncomeAccountId !== undefined ? next.mmfsIncomeAccountId : defaults.mmfsIncomeAccountId,
            mmfsIncomeBalancingAccountId:
                next.mmfsIncomeBalancingAccountId !== undefined
                    ? next.mmfsIncomeBalancingAccountId
                    : defaults.mmfsIncomeBalancingAccountId,
        };
        saveAccountingDefaults(merged);
    };

    const handleFinalizeIncome = async () => {
        if (!summary) return;
        if (!mmfsIncomeAccountId || !balancingAccountId) {
            toast({
                title: 'Select MMFS accounts',
                description: 'Please select both MMFS Income and Balancing accounts before finalising.',
                variant: 'destructive',
            });
            return;
        }

        if (summary.summary.mmfs_income <= 0) {
            toast({
                title: 'No income to recognise',
                description: 'Income is zero; nothing to finalise for this debit note.',
            });
            return;
        }

        try {
            setFinalizing(true);
            const result = await finalizeDebitIncome(debitNoteId, {
                mmfs_income_account_id: mmfsIncomeAccountId,
                balancing_account_id: balancingAccountId,
            });

            toast({
                title: 'Income finalised',
                description: `Income journal ${result.income_reference} created for DN ${result.debit_note_id}.`,
            });

            // Reload summary so it reflects the latest state
            await loadAll();
        } catch (error: any) {
            console.error('Failed to finalise MMFS income', error);
            toast({
                title: 'Finalisation failed',
                description: error?.message || 'Could not finalise MMFS income.',
                variant: 'destructive',
            });
        } finally {
            setFinalizing(false);
        }
    };

    const findAccountName = (id?: number | null) => {
        if (!id) return '-';
        const acc = accounts.find(a => a.id === id);
        return acc ? `${acc.code} — ${acc.name}` : `#${id}`;
    };

    const mmfsIncome = summary?.summary.mmfs_income ?? 0;

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/debit-credit-notes')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-semibold">
                                Debit Note Credits & MMFS Income
                            </h1>
                            {journal && (
                                <p className="text-sm text-muted-foreground">
                                    {journal.reference} • {journal.date} • {journal.description || 'Debit note'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/notes/credit/new?debitId=${debitNoteId}`)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Credit Note for this Debit
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => loadAll()}
                            disabled={loading}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Debit & Credits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {summary ? (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Debit Amount</span>
                                        <span className="font-semibold">
                                            {Number(summary.summary.debit_total || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Credits Allocated</span>
                                        <span className="font-semibold">
                                            {Number(summary.summary.total_credits_allocated || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                        <span>Remaining</span>
                                        <span className="font-semibold">
                                            {Number(summary.summary.remaining_amount || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <AlertCircle className="h-4 w-4" />
                                    {loading ? 'Loading...' : 'No summary available'}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>MMFS Income</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span>Calculated Income</span>
                                    <span className="font-semibold">
                                        {mmfsIncome.toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Income = Debit Amount – Total Credits Allocated
                                </div>
                                {mmfsIncome > 0 ? (
                                    <div className="flex items-center gap-2 text-xs text-green-700 mt-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Ready to be recognised as MMFS Income.
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-amber-700 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        No positive income amount yet (or fully offset by credits).
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>MMFS Income Accounts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <div className="text-xs font-medium">MMFS Income Account</div>
                                <Select
                                    value={mmfsIncomeAccountId ? String(mmfsIncomeAccountId) : undefined}
                                    onValueChange={val => {
                                        const nextId = Number(val);
                                        setMmfsIncomeAccountId(nextId);
                                        handleSaveDefaults({ mmfsIncomeAccountId: nextId });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select MMFS Income account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(a => (
                                            <SelectItem key={a.id} value={String(a.id)}>
                                                {a.code} — {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <div className="text-xs font-medium">Balancing Account</div>
                                <Select
                                    value={balancingAccountId ? String(balancingAccountId) : undefined}
                                    onValueChange={val => {
                                        const nextId = Number(val);
                                        setBalancingAccountId(nextId);
                                        handleSaveDefaults({ mmfsIncomeBalancingAccountId: nextId });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select balancing account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(a => (
                                            <SelectItem key={a.id} value={String(a.id)}>
                                                {a.code} — {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                DR {findAccountName(balancingAccountId)} / CR {findAccountName(mmfsIncomeAccountId)} for the income amount.
                            </div>

                            <Button
                                className="w-full mt-2"
                                onClick={handleFinalizeIncome}
                                disabled={loading || finalizing || !summary}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Finalise MMFS Income
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Linked Credit Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {summary && summary.credits.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Credit Note</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.credits.map(credit => (
                                        <TableRow key={`${credit.credit_note_id}-${credit.credit_date}`}>
                                            <TableCell>{credit.credit_reference}</TableCell>
                                            <TableCell>{credit.credit_date}</TableCell>
                                            <TableCell>{credit.amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                No credit notes have been applied to this debit yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
};

export default DebitNoteCreditsWizard;