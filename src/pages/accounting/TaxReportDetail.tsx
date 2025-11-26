import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Trash2, CheckCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
  getTaxReport,
  reviewTaxReturn,
  submitTaxReturn,
  deleteTaxReturn,
  exportTaxReturn,
  updateTaxReturn,
  type TaxReturnDTO,
  type TaxReturnLineDTO,
} from '@/lib/api/accounting';
import { getPrimaryRole } from '@/lib/api/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MainLayout from '@/components/layout/MainLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TaxReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getPrimaryRole();
  const userId = Number(localStorage.getItem('user_id')) || 1;

  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');

  // Fetch tax report
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tax-report', id],
    queryFn: () => getTaxReport(Number(id), role),
    enabled: !!id,
    onError: (error: any) => {
      toast.error('Failed to load tax report', {
        description: error?.message || 'Please try again later',
      });
    },
  });

  const taxReturn = data?.taxReturn;
  const lines = data?.lines || [];

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: () => reviewTaxReturn(Number(id), role, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-report', id]);
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return marked as reviewed');
    },
    onError: (error: any) => {
      toast.error('Failed to review tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => submitTaxReturn(Number(id), role, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-report', id]);
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return submitted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to submit tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteTaxReturn(Number(id), role),
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return deleted successfully');
      navigate('/accounting/tax-reports');
    },
    onError: (error: any) => {
      toast.error('Failed to delete tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Update mutation (manual override)
  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: any = {};
      if (overrideAmount) payload.amount = parseFloat(overrideAmount);
      if (overrideNotes) payload.notes = overrideNotes;
      return updateTaxReturn(Number(id), payload, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tax-report', id]);
      queryClient.invalidateQueries(['tax-reports']);
      toast.success('Tax return updated successfully');
      setIsEditingOverride(false);
      setOverrideAmount('');
      setOverrideNotes('');
    },
    onError: (error: any) => {
      toast.error('Failed to update tax return', {
        description: error?.message || 'Please try again',
      });
    },
  });

  // Export handler
  const handleExport = async () => {
    try {
      toast.info('Generating Excel export...');
      const blob = await exportTaxReturn(Number(id), role);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-return-${id}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel file downloaded');
    } catch (error: any) {
      toast.error('Failed to export tax return', {
        description: error?.message || 'Please try again',
      });
    }
  };

  // Helper functions
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(num);
  };

  const getTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      VAT: 'Value Added Tax (VAT)',
      Employee_Tax: 'Employee Tax (PAYE)',
      Provisional_Tax: 'Provisional Tax',
      Income_Tax: 'Income Tax',
    };
    return typeMap[type] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'submitted':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (isError || !taxReturn) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Loading Tax Report</CardTitle>
              <CardDescription>
                The tax report could not be loaded. Please try again later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/accounting/tax-reports')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tax Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const canEdit = (role === 'admin' || role === 'accountant') && taxReturn.status === 'draft';
  const canReview = (role === 'admin' || role === 'accountant') && taxReturn.status === 'draft';
  const canSubmit = (role === 'admin' || role === 'accountant') && taxReturn.status === 'reviewed';
  const canDelete = (role === 'admin' || role === 'accountant') && (taxReturn.status === 'draft' || taxReturn.status === 'reviewed');
  const canExport = taxReturn.status === 'submitted';

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/accounting/tax-reports')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                Tax Return #{taxReturn.id}
              </h1>
              <Badge className={getStatusColor(taxReturn.status)}>
                {taxReturn.status.charAt(0).toUpperCase() + taxReturn.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {getTypeName(taxReturn.type)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {canReview && (
              <Button
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Reviewed
              </Button>
            )}
            {canSubmit && (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isLoading}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Return
              </Button>
            )}
            {canExport && (
              <Button onClick={handleExport} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Tax Return?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this tax return. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Tax Return Details */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Return Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                <p className="text-sm font-medium">{getTypeName(taxReturn.type)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Period</Label>
                <p className="text-sm font-medium">
                  {formatDate(taxReturn.period_start)} - {formatDate(taxReturn.period_end)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Due Date</Label>
                <p className="text-sm font-medium">{formatDate(taxReturn.due_date)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Amount</Label>
                <p className="text-lg font-bold">{formatCurrency(taxReturn.amount)}</p>
              </div>
            </div>

            {taxReturn.reference && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Reference</Label>
                <p className="text-sm">{taxReturn.reference}</p>
              </div>
            )}

            {taxReturn.submitted_date && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Submitted Date</Label>
                <p className="text-sm">{formatDate(taxReturn.submitted_date)}</p>
              </div>
            )}

            {taxReturn.notes && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                <p className="text-sm whitespace-pre-wrap">{taxReturn.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Created:</span> {formatDate(taxReturn.created_at)}
                {taxReturn.created_by && <span> by User #{taxReturn.created_by}</span>}
              </div>
              {taxReturn.reviewed_at && (
                <div>
                  <span className="font-medium">Reviewed:</span> {formatDate(taxReturn.reviewed_at)}
                  {taxReturn.reviewed_by && <span> by User #{taxReturn.reviewed_by}</span>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual Override Section (Draft only) */}
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Manual Override</CardTitle>
              <CardDescription>
                Adjust the calculated amount or add notes before review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEditingOverride ? (
                <Button onClick={() => {
                  setIsEditingOverride(true);
                  setOverrideAmount(taxReturn.amount);
                  setOverrideNotes(taxReturn.notes || '');
                }}>
                  Edit Amount & Notes
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="override-amount">Amount (ZAR)</Label>
                    <Input
                      id="override-amount"
                      type="number"
                      step="0.01"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="override-notes">Notes</Label>
                    <Textarea
                      id="override-notes"
                      value={overrideNotes}
                      onChange={(e) => setOverrideNotes(e.target.value)}
                      placeholder="Add notes or explanation for manual override"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isLoading}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingOverride(false);
                        setOverrideAmount('');
                        setOverrideNotes('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>
              {lines.length} line item{lines.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Manual Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>
                        {line.account_id ? `Account #${line.account_id}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {line.is_manual_override ? (
                          <Badge variant="secondary">Manual</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Auto</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default TaxReportDetail;
