import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Calendar,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  getPeriods,
  getYearEndChecklist,
  PeriodDTO,
  YearEndTaskDTO,
  updatePeriod,
  updateYearEndTask,
} from '@/lib/api/accounting';

const PeriodEnd = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);

  const [periods, setPeriods] = useState<PeriodDTO[]>([]);
  const [yearTasks, setYearTasks] = useState<YearEndTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const fiscalYear = new Date().getFullYear();

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [periodRes, taskRes] = await Promise.all([
        getPeriods({ year: fiscalYear }),
        getYearEndChecklist({ year: fiscalYear }),
      ]);

      setPeriods(periodRes.items || []);
      setYearTasks(taskRes.items || []);
    } catch (err: any) {
      console.error('[PeriodEnd] Failed to load data', err);
      setError(err?.message || 'Failed to load period-end data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPeriod: PeriodDTO | undefined = (() => {
    if (!periods || periods.length === 0) return undefined;
    const inProgress = periods.find(p => p.status === 'In Progress');
    if (inProgress) return inProgress;
    // Fallback: latest by period_start
    return [...periods].sort(
      (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    )[periods.length - 1];
  })();

  const checklistValues: boolean[] = currentPeriod
    ? [
      currentPeriod.reconciliations_done,
      currentPeriod.journals_done,
      currentPeriod.accounts_done,
      currentPeriod.taxes_done,
      currentPeriod.reports_done,
    ]
    : [];

  const completedChecks = checklistValues.filter(v => v).length;
  const monthCompletionPercentage =
    checklistValues.length > 0
      ? (completedChecks / checklistValues.length) * 100
      : 0;

  const completedTasks = yearTasks.filter(t => t.completed).length;
  const totalTasks = yearTasks.length;
  const completionPercentage =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleConfirmClose = async () => {
    if (!currentPeriod) return;
    setClosing(true);
    setError(null);
    try {
      await updatePeriod(
        currentPeriod.id,
        {
          status: 'Closed',
        },
        'accountant',
        1
      );
      await loadData();
      setShowDialog(false);
    } catch (err: any) {
      console.error('[PeriodEnd] Failed to close period', err);
      setError(err?.message || 'Failed to close period');
    } finally {
      setClosing(false);
    }
  };

  const handleCompleteTask = async (task: YearEndTaskDTO) => {
    setUpdatingTaskId(task.id);
    setError(null);
    try {
      await updateYearEndTask(task.id, true, 'accountant', 1);
      const res = await getYearEndChecklist({ year: fiscalYear });
      setYearTasks(res.items || []);
    } catch (err: any) {
      console.error('[PeriodEnd] Failed to update year-end task', err);
      setError(err?.message || 'Failed to update year-end task');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const currentLabel = currentPeriod?.label || 'No active period';
  const yearStartLabel = `January 1, ${fiscalYear}`;
  const yearEndLabel = `December 31, ${fiscalYear}`;

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">Loading period-end data...</div>
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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">
            Period End Processes
          </h1>
          <p className="text-white/80">
            Manage month-end and year-end closing procedures
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Period Status</CardTitle>
              <CardDescription>{currentLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Month-End Progress</span>
                    <span className="text-sm">
                      {completedChecks} of {checklistValues.length} tasks completed
                    </span>
                  </div>
                  <Progress value={monthCompletionPercentage} className="h-2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="border rounded-md p-3 text-center">
                    <div className="mb-2">
                      {currentPeriod?.reconciliations_done ? (
                        <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs">Reconciliations</p>
                  </div>

                  <div className="border rounded-md p-3 text-center">
                    <div className="mb-2">
                      {currentPeriod?.journals_done ? (
                        <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs">Journals</p>
                  </div>

                  <div className="border rounded-md p-3 text-center">
                    <div className="mb-2">
                      {currentPeriod?.accounts_done ? (
                        <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs">Accounts</p>
                  </div>

                  <div className="border rounded-md p-3 text-center">
                    <div className="mb-2">
                      {currentPeriod?.taxes_done ? (
                        <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs">Taxes</p>
                  </div>

                  <div className="border rounded-md p-3 text-center">
                    <div className="mb-2">
                      {currentPeriod?.reports_done ? (
                        <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs">Reports</p>
                  </div>
                </div>

                <Alert className="bg-amber-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    Complete all required tasks before closing the current period.
                    Missing tasks: Accounts verification, Financial reports generation.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-between items-center pt-4">
                  <div className="text-sm">
                    <p>
                      Current Period:{' '}
                      <span className="font-medium">{currentLabel}</span>
                    </p>
                    <p>
                      Financial Year:{' '}
                      <span className="font-medium">
                        Jan {fiscalYear} - Dec {fiscalYear}
                      </span>
                    </p>
                  </div>

                  <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={
                          !currentPeriod ||
                          monthCompletionPercentage < 100 ||
                          closing
                        }
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {closing ? 'Closing...' : 'Close Period'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Period Close</DialogTitle>
                        <DialogDescription>
                          You are about to close the accounting period for{' '}
                          {currentLabel}. This action cannot be easily reversed. All
                          transactions for this period will be locked (soft status
                          only).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertCircle className="h-4 w-4" />
                          <p className="text-sm font-medium">
                            Make sure you've completed all period-end tasks.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowDialog(false)}
                          disabled={closing}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleConfirmClose} disabled={closing}>
                          Confirm Close Period
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Year-End Status</CardTitle>
              <CardDescription>Fiscal Year {fiscalYear}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm">
                    {completedTasks} of {totalTasks} tasks
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>

              <div className="text-sm">
                <p>
                  Year Start:{' '}
                  <span className="font-medium">{yearStartLabel}</span>
                </p>
                <p>
                  Year End:{' '}
                  <span className="font-medium">{yearEndLabel}</span>
                </p>
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/reports')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Year-to-Date Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Period Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Date Closed
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Closed By
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {periods.map(period => (
                    <tr key={period.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">{period.label}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${period.status === 'Closed'
                            ? 'bg-green-100 text-green-800'
                            : period.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {period.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDate(period.closed_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {period.closed_by ? `User ${period.closed_by}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        {period.status === 'Closed' && (
                          <Button size="sm" variant="outline">
                            View Reports
                          </Button>
                        )}
                        {period.status === 'In Progress' && (
                          <Button size="sm" variant="default">
                            Continue Tasks
                          </Button>
                        )}
                        {period.status === 'Future' && (
                          <Button size="sm" variant="outline" disabled>
                            Not Available
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Year-End Checklist</CardTitle>
            <CardDescription>
              Tasks to complete before closing the fiscal year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-4 space-y-4">
              {yearTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 ${task.completed ? 'text-green-600' : 'text-gray-300'
                      }`}
                  >
                    {task.completed ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.task}</p>
                    {task.critical && !task.completed && (
                      <p className="text-xs text-amber-600">
                        Required before year-end close
                      </p>
                    )}
                  </div>
                  {!task.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCompleteTask(task)}
                      disabled={updatingTaskId === task.id}
                    >
                      {updatingTaskId === task.id ? 'Updating...' : 'Start'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/50 flex justify-between">
            <Button
              variant="outline"
              onClick={() => navigate('/accounting/year-end-planner')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Year-End Planner
            </Button>
            <Button onClick={() => navigate('/reports')}>Generate Year-End Reports</Button>
          </CardFooter>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => navigate('/reports')}>
            View All Financial Reports
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    </MainLayout>
  );
};

export default PeriodEnd;
