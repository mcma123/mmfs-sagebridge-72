import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download, Calendar, FileText, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  getTaxReports,
  getTaxLiabilities,
  getUpcomingTaxReturns,
  submitTaxReturn,
  reviewTaxReturn,
  deleteTaxReturn,
  exportTaxReturn,
  type TaxReturnDTO,
  type TaxLiabilityDTO,
  type UpcomingTaxReturnDTO,
} from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';

const TaxReports = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taxReturnToDelete, setTaxReturnToDelete] = useState<TaxReturnDTO | null>(null);

  const role = getPrimaryRole();
  const userId = Number(localStorage.getItem('user_id')) || 1;

  // Map tab to status filter
  const statusMap: Record<string, string | undefined> = {
    all: undefined,
    draft: 'draft',
    reviewed: 'reviewed',
    submitted: 'submitted',
  };

  // Map type filter to API value
  const getTypeFilter = () => {
    if (typeFilter === 'all') return undefined;
    if (typeFilter === 'vat') return 'VAT';
    if (typeFilter === 'employee') return 'Employee_Tax';
    if (typeFilter === 'provisional') return 'Provisional_Tax';
    return undefined;
  };

  // Fetch tax reports with filters
  const { data: taxReportsData, isLoading: reportsLoading, isError: reportsError, error: reportsErrorObj } = useQuery({
    queryKey: ['tax-reports', yearFilter, getTypeFilter(), statusMap[activeTab], role],
    queryFn: () => getTaxReports({ year: yearFilter, type: getTypeFilter(), status: statusMap[activeTab] }, role),
    onError: (error: any) => {
      toast.error('Failed to load tax reports', {
        description: error?.message || 'Please try again later',
      });
    },
  });

  // Fetch tax liabilities
  const { data: liabilitiesData, isLoading: liabilitiesLoading } = useQuery({
    queryKey: ['tax-liabilities', role],
    queryFn: () => getTaxLiabilities(role),
    onError: (error: any) => {
      toast.error('Failed to load tax liabilities', {
        description: error?.message || 'Please try again later',
      });
    },
  });

  // Fetch upcoming tax deadlines
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['tax-reports-upcoming', role],
    queryFn: () => getUpcomingTaxReturns(role),
    enabled: role === 'admin' || role === 'accountant',
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => submitTaxReturn(id, role, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return submitted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to submit tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => reviewTaxReturn(id, role, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return marked as reviewed');
    },
    onError: (error: any) => {
      toast.error('Failed to review tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => deleteTaxReturn(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-reports']);
      setDeleteDialogOpen(false);
      setTaxReturnToDelete(null);
      toast.success('Tax return deleted permanently');
    },
    onError: (error: any) => {
      toast.error('Failed to delete tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Export handler
  const handleExport = async (id: number, taxReturn: TaxReturnDTO) => {
    try {
      toast.info('Preparing export...');
      const blob = await exportTaxReturn(id, role);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-return-${taxReturn.type}-${taxReturn.period_start}-${taxReturn.period_end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Tax return exported successfully');
    } catch (error: any) {
      toast.error('Failed to export tax return', {
        description: error?.message || 'Please try again',
      });
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (report: TaxReturnDTO) => {
    setTaxReturnToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (taxReturnToDelete) {
      deleteMutation.mutate({ id: taxReturnToDelete.id });
    }
  };

  const taxReports = taxReportsData?.items || [];
  const taxLiabilities = liabilitiesData?.items || [];
  const upcomingReturns = upcomingData?.items || [];

  // Calculate total liabilities
  const totalLiabilities = useMemo(() => {
    return taxLiabilities.reduce((sum, liability) => sum + parseFloat(liability.amount || '0'), 0);
  }, [taxLiabilities]);

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get human-readable type name
  const getTypeName = (type: string) => {
    switch (type) {
      case 'VAT':
        return 'VAT Return';
      case 'Employee_Tax':
        return 'Employee Tax';
      case 'Provisional_Tax':
        return 'Provisional Tax';
      case 'Income_Tax':
        return 'Income Tax';
      default:
        return type;
    }
  };

  // Render table row
  const renderTableRow = (report: TaxReturnDTO) => (
    <TableRow key={report.id}>
      <TableCell className="font-medium">
        {getTypeName(report.type)} - {formatDate(report.period_start)} to {formatDate(report.period_end)}
      </TableCell>
      <TableCell>{formatDate(report.period_start)} - {formatDate(report.period_end)}</TableCell>
      <TableCell>{formatDate(report.due_date)}</TableCell>
      <TableCell>
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(report.status)}`}>
          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
        </span>
      </TableCell>
      {activeTab === 'all' && (
        <TableCell>{report.submitted_date ? formatDate(report.submitted_date) : '-'}</TableCell>
      )}
      <TableCell>{formatCurrency(report.amount)}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/accounting/tax-reports/${report.id}`)}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
          {report.status === 'draft' && (role === 'admin' || role === 'accountant') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => reviewMutation.mutate({ id: report.id })}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Review'}
            </Button>
          )}
          {report.status === 'reviewed' && (role === 'admin' || role === 'accountant') && (
            <Button
              size="sm"
              onClick={() => submitMutation.mutate({ id: report.id })}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit'}
            </Button>
          )}
          {report.status === 'submitted' && (
            <Button size="sm" variant="outline" onClick={() => handleExport(report.id, report)}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          )}
          {(role === 'admin' || role === 'accountant') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteClick(report)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/accounting')}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Accounting
          </Button>
        </div>

        <div className="bg-sage-blue rounded-lg p-6 shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">Tax Reports</h1>
            <p className="text-white/80">Prepare, review, and submit your tax reports</p>
          </div>
          {(role === 'admin' || role === 'accountant') && (
            <Button variant="secondary" onClick={() => navigate('/accounting/tax-reports/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Tax Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              {liabilitiesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-sage-blue" />
                </div>
              ) : taxLiabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tax liabilities</p>
              ) : (
                <>
                  <div className="space-y-4">
                    {taxLiabilities.map(liability => (
                      <div key={liability.account_id} className="flex justify-between items-center pb-2 border-b last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{liability.name}</p>
                          <p className="text-xs text-muted-foreground">Account: {liability.code}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(liability.amount)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Due:</span>
                      <span className="font-bold">{formatCurrency(totalLiabilities)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax Calendar</CardTitle>
              <CardDescription>Upcoming tax return due dates</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-sage-blue" />
                </div>
              ) : upcomingReturns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming tax deadlines</p>
              ) : (
                <div className="space-y-3">
                  {upcomingReturns.slice(0, 3).map((upcoming, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center p-3 border rounded-md ${idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-white'
                        }`}
                    >
                      <div className={`p-2 rounded-full mr-3 ${idx === 0 ? 'bg-amber-100' : 'bg-sage-lightGray'}`}>
                        <Calendar className={`h-4 w-4 ${idx === 0 ? 'text-amber-700' : 'text-sage-blue'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{getTypeName(upcoming.type)}</p>
                        <p className="text-xs text-muted-foreground">Due on {formatDate(upcoming.due_date)}</p>
                      </div>
                      <Button size="sm" variant={idx === 0 ? 'default' : 'outline'}>Prepare</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Alert className="bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important Tax Notice</AlertTitle>
          <AlertDescription>
            Ensure all your tax submissions are accurate and submitted on time to avoid penalties.
            Consider consulting with a tax professional for complex tax matters.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Tax Returns & Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                  <TabsTrigger value="submitted">Submitted</TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                      <SelectItem value="2022">2022</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tax Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="vat">VAT</SelectItem>
                      <SelectItem value="employee">Employee Tax</SelectItem>
                      <SelectItem value="provisional">Provisional Tax</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reportsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-sage-blue" />
                </div>
              ) : reportsError ? (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-2">Failed to load tax reports</p>
                  <p className="text-sm text-muted-foreground">{(reportsErrorObj as any)?.message}</p>
                </div>
              ) : taxReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No tax reports found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'all' ? 'Generate your first tax report to get started' : `No ${activeTab} tax returns`}
                  </p>
                </div>
              ) : (
                <>
                  <TabsContent value="all" className="mt-0">
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Report Name</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxReports.map(renderTableRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="draft" className="mt-0">
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Report Name</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxReports.map(renderTableRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="reviewed" className="mt-0">
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Report Name</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxReports.map(renderTableRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="submitted" className="mt-0">
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Report Name</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Submitted Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxReports.map(renderTableRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tax return{' '}
              {taxReturnToDelete && (
                <span className="font-semibold">
                  "{getTypeName(taxReturnToDelete.type)} - {formatDate(taxReturnToDelete.period_start)} to {formatDate(taxReturnToDelete.period_end)}"
                </span>
              )}{' '}
              and remove all associated data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default TaxReports;
