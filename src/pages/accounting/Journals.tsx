
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Search,
  Plus,
  FileUp,
  Printer,
  ArrowLeft,
  CheckSquare,
  Filter,
  ChevronDown
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { deleteJournal, getJournals, reviewJournal, voidJournal, type JournalDTO } from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';
import { toast } from '@/hooks/use-toast';

const Journals = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedJournalMap, setSelectedJournalMap] = useState<Record<number, JournalDTO>>({});
  const [activeTab, setActiveTab] = useState<'draft' | 'reviewed' | 'posted'>('draft');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const role = getPrimaryRole();
  const queryClient = useQueryClient();

  // Fetch journals from API based on active tab
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['journals', activeTab],
    queryFn: () => getJournals({ status: activeTab }, role as any),
    onError: (error: any) => {
      toast({
        title: 'Error loading journals',
        description: error.message || 'Failed to load journals from database',
        variant: 'destructive',
      });
    },
  });

  // Filter journal entries based on search term (client-side)
  const filteredJournals = (data?.items || [])
    .filter(journal =>
      journal.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      journal.reference?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    // For the Posted tab, hide journals that have already been voided
    .filter(journal => {
      if (activeTab !== 'posted') return true;
      return !journal.voided_at;
    });

  const toggleSelectRow = (journal: JournalDTO) => {
    setSelectedRows(prev =>
      prev.includes(journal.id)
        ? prev.filter(rowId => rowId !== journal.id)
        : [...prev, journal.id]
    );
    setSelectedJournalMap(prev => {
      const next = { ...prev };
      if (next[journal.id]) {
        delete next[journal.id];
      } else {
        next[journal.id] = journal;
      }
      return next;
    });
  };

  const toggleSelectAll = (journals: JournalDTO[]) => {
    const ids = journals.map(journal => journal.id);
    const allSelected = ids.every(id => selectedRows.includes(id));

    setSelectedRows(prev => {
      if (allSelected) {
        return prev.filter(id => !ids.includes(id));
      }
      const merged = new Set(prev);
      ids.forEach(id => merged.add(id));
      return Array.from(merged);
    });

    setSelectedJournalMap(prev => {
      const next = { ...prev };
      if (allSelected) {
        ids.forEach(id => {
          delete next[id];
        });
      } else {
        journals.forEach(journal => {
          next[journal.id] = journal;
        });
      }
      return next;
    });
  };

  const getStatusForSelection = (id: number): JournalDTO['status'] | undefined => {
    return selectedJournalMap[id]?.status ?? (activeTab as JournalDTO['status']);
  };

  const handleMarkReviewed = async () => {
    if (isActionLoading) return;

    const draftIds = selectedRows.filter(id => getStatusForSelection(id) === 'draft');
    if (draftIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No draft journals selected',
        description: 'Select draft journals to mark them as reviewed.',
      });
      return;
    }

    setIsActionLoading(true);
    try {
      const results = await Promise.allSettled(
        draftIds.map(id => reviewJournal(id, role as any, 1))
      );
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast({
          title: 'Journals reviewed',
          description: `Marked ${successCount} journal${successCount > 1 ? 's' : ''} as reviewed.`,
        });
      }

      if (failureCount > 0) {
        const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const errorMsg = firstError?.reason?.message || 'Unknown error';
        toast({
          variant: 'destructive',
          title: 'Some journals failed to review',
          description: `${failureCount} journal${failureCount > 1 ? 's' : ''} could not be updated. ${errorMsg}`,
        });
      }

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['journals'] });

      setSelectedRows([]);
      setSelectedJournalMap({});

      if (successCount > 0) {
        setActiveTab('reviewed');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to review journals',
        description: err?.message || 'Something went wrong while marking journals as reviewed.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (isActionLoading || selectedRows.length === 0) return;

    const draftOrReviewedIds: number[] = [];
    const postedIds: number[] = [];
    const unsupportedIds: number[] = [];

    selectedRows.forEach(id => {
      const status = getStatusForSelection(id);
      const journal = selectedJournalMap[id];
      const isVoided = !!journal?.voided_at;

      if (status === 'draft' || status === 'reviewed') {
        draftOrReviewedIds.push(id);
      } else if (status === 'posted' && !isVoided) {
        // Only attempt to void posted journals that are not already voided
        postedIds.push(id);
      } else {
        // Already-voided or unknown-status journals are treated as unsupported for delete/void
        unsupportedIds.push(id);
      }
    });

    if (draftOrReviewedIds.length === 0 && postedIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No removable journals selected',
        description: 'Only draft or reviewed journals can be deleted. Posted journals will be voided automatically.',
      });
      return;
    }

    setIsActionLoading(true);
    try {
      const deleteResults = await Promise.allSettled(
        draftOrReviewedIds.map(id => deleteJournal(id, role as any))
      );
      const voidResults = await Promise.allSettled(
        postedIds.map(id => voidJournal(id, 'Voided via journals delete action', role as any, 1))
      );

      const deletedCount = deleteResults.filter(result => result.status === 'fulfilled').length;
      const voidedCount = voidResults.filter(result => result.status === 'fulfilled').length;
      const deleteFailures = deleteResults.length - deletedCount;
      const voidFailures = voidResults.length - voidedCount;

      if (deletedCount > 0) {
        toast({
          title: 'Journals deleted',
          description: `Removed ${deletedCount} journal${deletedCount > 1 ? 's' : ''}.`,
        });
      }

      if (voidedCount > 0) {
        toast({
          title: 'Journals voided',
          description: `Voided ${voidedCount} posted journal${voidedCount > 1 ? 's' : ''}.`,
        });
      }

      if (deleteFailures + voidFailures > 0) {
        const firstDeleteError = deleteResults.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const firstVoidError = voidResults.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const errorMsg = firstDeleteError?.reason?.message || firstVoidError?.reason?.message || 'Unknown error';
        toast({
          variant: 'destructive',
          title: 'Some journals could not be processed',
          description: `${deleteFailures + voidFailures} journal${deleteFailures + voidFailures > 1 ? 's' : ''} failed to delete or void. ${errorMsg}`,
        });
      }

      if (unsupportedIds.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Unsupported journal statuses',
          description: `${unsupportedIds.length} selected journal${unsupportedIds.length > 1 ? 's are' : ' is'} in an unsupported status.`,
        });
      }

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['journals'] });

      setSelectedRows([]);
      setSelectedJournalMap({});
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete journals',
        description: err?.message || 'Something went wrong while deleting journals.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const selectedDraftCount = selectedRows.filter(id => getStatusForSelection(id) === 'draft').length;
  const hasDeleteCandidates = selectedRows.some(id => {
    const status = getStatusForSelection(id);
    return status === 'draft' || status === 'reviewed' || status === 'posted';
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'reviewed':
        return <Badge variant="secondary">Reviewed</Badge>;
      case 'posted':
        return <Badge variant="default">Posted</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
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
          <h1 className="text-2xl font-semibold text-white mb-2">Journal Entries</h1>
          <p className="text-white/80">Create and manage journal transactions</p>
        </div>

        {/* Journal Entries List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Process Journal Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="draft" onValueChange={(v) => setActiveTab(v as 'draft' | 'reviewed' | 'posted')}>
              <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
                <TabsList className="mb-0">
                  <TabsTrigger value="draft">New Journals</TabsTrigger>
                  <TabsTrigger value="reviewed">Reviewed Journals</TabsTrigger>
                  <TabsTrigger value="posted">Posted Journals</TabsTrigger>
                </TabsList>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" className="gap-1">
                    <FileUp size={16} />
                    Import
                  </Button>
                  <Button variant="outline" className="gap-1">
                    <Printer size={16} />
                    Print
                  </Button>
                  <Button className="gap-1" onClick={() => navigate('/accounting/journals/new')}>
                    <Plus size={16} />
                    New Journal
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search journals..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" className="shrink-0">
                  <Filter size={16} />
                </Button>
              </div>

              {/* Batch Actions */}
              {selectedRows.length > 0 && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-sage-lightGray rounded-md">
                  <CheckSquare size={16} className="text-sage-blue" />
                  <span className="text-sm font-medium">{selectedRows.length} entries selected</span>
                  <div className="flex-1"></div>

                  {activeTab === 'draft' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sage-blue hover:bg-sage-blue/10"
                      onClick={handleMarkReviewed}
                      disabled={isActionLoading || selectedDraftCount === 0}
                    >
                      Mark as Reviewed
                    </Button>
                  )}

                  {activeTab === 'reviewed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sage-blue hover:bg-sage-blue/10"
                      disabled={isActionLoading}
                    >
                      Post Entries
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleDeleteSelected}
                    disabled={isActionLoading || !hasDeleteCandidates}
                  >
                    Delete
                  </Button>
                </div>
              )}

              <TabsContent value="draft" className="m-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading journals...</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600">Error loading journals</div>
                ) : (
                  renderJournalTable(filteredJournals, selectedRows, toggleSelectRow, toggleSelectAll, getStatusBadge)
                )}
              </TabsContent>

              <TabsContent value="reviewed" className="m-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading journals...</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600">Error loading journals</div>
                ) : (
                  renderJournalTable(filteredJournals, selectedRows, toggleSelectRow, toggleSelectAll, getStatusBadge)
                )}
              </TabsContent>

              <TabsContent value="posted" className="m-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading journals...</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600">Error loading journals</div>
                ) : (
                  renderJournalTable(filteredJournals, selectedRows, toggleSelectRow, toggleSelectAll, getStatusBadge)
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Journal Workflow Explanation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Understanding Journal Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <h3 className="font-medium">1. New Journals</h3>
                <p className="text-sm text-muted-foreground">
                  Journal entries start as drafts. These are transactions that have been recorded but not yet verified.
                  In this stage, entries can be freely edited or deleted.
                </p>
              </div>

              <div className="flex-1 space-y-2">
                <h3 className="font-medium">2. Reviewed Journals</h3>
                <p className="text-sm text-muted-foreground">
                  After verification, journals are marked as reviewed. This indicates that the entries have been
                  checked and approved, but are not yet permanently recorded in the general ledger.
                </p>
              </div>

              <div className="flex-1 space-y-2">
                <h3 className="font-medium">3. Posted Journals</h3>
                <p className="text-sm text-muted-foreground">
                  Once posted, journal entries are permanently recorded in the general ledger and affect account balances.
                  Posted entries cannot be deleted, only reversed with a new correcting entry.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

function renderJournalTable(
  journals: JournalDTO[],
  selectedRows: number[],
  toggleSelectRow: (journal: JournalDTO) => void,
  toggleSelectAll: (journals: JournalDTO[]) => void,
  getStatusBadge: (status: string) => React.ReactNode
) {
  const visibleSelectedCount = journals.filter(journal => selectedRows.includes(journal.id)).length;
  const allVisibleSelected = journals.length > 0 && visibleSelectedCount === journals.length;
  const headerCheckboxState = allVisibleSelected
    ? true
    : visibleSelectedCount > 0
      ? 'indeterminate'
      : false;

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-sage-lightGray">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={headerCheckboxState}
                onCheckedChange={() => toggleSelectAll(journals)}
              />
            </TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="w-[120px]">Reference</TableHead>
            <TableHead className="min-w-[200px]">Description</TableHead>
            <TableHead className="text-right w-[120px]">Amount</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {journals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                No journal entries found
              </TableCell>
            </TableRow>
          ) : (
            journals.map(journal => (
              <TableRow
                key={journal.id}
                className={selectedRows.includes(journal.id) ? 'bg-blue-50' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(journal.id)}
                    onCheckedChange={() => toggleSelectRow(journal)}
                  />
                </TableCell>
                <TableCell>{journal.date}</TableCell>
                <TableCell>{journal.reference || '-'}</TableCell>
                <TableCell className="font-medium cursor-pointer hover:text-sage-blue">
                  {journal.description || '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  R{(journal.total_amount || 0).toFixed(2)}
                </TableCell>
                <TableCell>{getStatusBadge(journal.status || 'draft')}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default Journals;
