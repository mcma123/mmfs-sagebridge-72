
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectsProvider } from "@/lib/store/projects";
import { TasksProvider } from "@/lib/store/tasks";

// Page imports
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Login from "./pages/Login";

// DMS imports
import DMSLogin from "./pages/dms/DMSLogin";
import DMSDashboard from "./pages/dms/DMSDashboard";
import Projects from "./pages/dms/Projects";
import ProgressTracker from "./pages/dms/ProgressTracker";
import Documents from "./pages/dms/Documents";
import Tasks from "./pages/dms/Tasks";
import Banking from "./pages/Banking";
import ImportWizard from "./pages/banking/ImportWizard";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// Report pages
import BalanceSheet from './pages/reports/BalanceSheet';
import ExpenseReport from './pages/reports/ExpenseReport';
import TaxSummary from './pages/reports/TaxSummary';
import AccountsReceivable from './pages/reports/AccountsReceivable';
import AccountsPayable from './pages/reports/AccountsPayable';
import CashFlow from './pages/reports/CashFlow';
import Entities from "./pages/Entities";
import AddEntity from "./pages/entities/AddEntity";
import DebitCreditNotes from "./pages/DebitCreditNotes";
import CreateDebitNote from "./pages/notes/CreateDebitNote";
import CreateCreditNote from "./pages/notes/CreateCreditNote";
import DebitNoteCreditsWizard from "./pages/notes/DebitNoteCreditsWizard";
import ViewDebitNote from "./pages/notes/ViewDebitNote";
import ViewCreditNote from "./pages/notes/ViewCreditNote";
import PaymentReconciliation from "./pages/PaymentReconciliation";
import NotFound from "./pages/NotFound";
import Administration from './pages/Administration';
import ManageUsers from './pages/administration/ManageUsers';
import AddUser from './pages/administration/AddUser';
import UserAccess from './pages/administration/UserAccess';
import ChangePassword from './pages/administration/ChangePassword';
import MyAccount from './pages/administration/MyAccount';

// Accounting pages
import Accounting from './pages/Accounting';
import ChartOfAccounts from './pages/accounting/ChartOfAccounts';
import AccountDetail from './pages/accounting/AccountDetail';
import Journals from './pages/accounting/Journals';
import CreateJournal from './pages/accounting/CreateJournal';
import GeneralLedger from './pages/accounting/GeneralLedger';
import TrialBalance from './pages/accounting/TrialBalance';
import AddAccount from './pages/accounting/AddAccount';
import EditAccount from './pages/accounting/EditAccount';
import Reconciliation from './pages/accounting/Reconciliation';
import AdjustOpeningBalance from './pages/accounting/AdjustOpeningBalance';
import TaxReports from './pages/accounting/TaxReports';
import CreateTaxReport from './pages/accounting/CreateTaxReport';
import TaxReportDetail from './pages/accounting/TaxReportDetail';
import PeriodEnd from './pages/accounting/PeriodEnd';
import YearEndPlanner from './pages/accounting/YearEndPlanner';
import AccountingDocuments from './pages/accounting/Documents';
import RoleGuard from '@/components/RoleGuard';

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <ProjectsProvider>
        <TasksProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/dashboard" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/entities" element={<Entities />} />
                    <Route path="/entities/add" element={<AddEntity />} />
                    <Route path="/debit-credit-notes" element={<DebitCreditNotes />} />
                    <Route path="/notes/debit/new" element={<CreateDebitNote />} />
                    <Route path="/notes/debit/:id" element={<ViewDebitNote />} />
                    <Route path="/notes/debit/:id/credits" element={<DebitNoteCreditsWizard />} />
                    <Route path="/notes/credit/new" element={<CreateCreditNote />} />
                    <Route path="/notes/credit/:id" element={<ViewCreditNote />} />
                    <Route path="/payment-reconciliation" element={<PaymentReconciliation />} />
                    <Route path="/banking" element={<Banking />} />
                    <Route path="/banking/import" element={<ImportWizard />} />

                    {/* Reports Routes */}
                    <Route path="/reports" element={<Reports />}>
                      <Route path="balance-sheet" element={<BalanceSheet />} />
                      <Route path="expenses" element={<ExpenseReport />} />
                      <Route path="tax-summary" element={<TaxSummary />} />
                      <Route path="receivables" element={<AccountsReceivable />} />
                      <Route path="payables" element={<AccountsPayable />} />
                      <Route path="cash-flow" element={<CashFlow />} />
                    </Route>

                    <Route path="/settings" element={<Settings />} />
                    <Route path="/administration" element={<RoleGuard allow={['admin']}><Administration /></RoleGuard>} />
                    <Route path="/administration/users" element={<RoleGuard allow={['admin']}><ManageUsers /></RoleGuard>} />
                    <Route path="/administration/users/add" element={<RoleGuard allow={['admin']}><AddUser /></RoleGuard>} />
                    <Route path="/administration/access" element={<RoleGuard allow={['admin']}><UserAccess /></RoleGuard>} />
                    <Route path="/administration/change-password" element={<RoleGuard allow={['admin']}><ChangePassword /></RoleGuard>} />
                    <Route path="/administration/my-account" element={<RoleGuard allow={['admin']}><MyAccount /></RoleGuard>} />

                    {/* Accounting Routes */}
                    <Route path="/accounting" element={<Accounting />} />
                    <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                    <Route path="/accounting/account/:id" element={<AccountDetail />} />
                    <Route path="/accounting/journals" element={<Journals />} />
                    <Route path="/accounting/journals/new" element={<CreateJournal />} />
                    <Route path="/accounting/general-ledger" element={<GeneralLedger />} />
                    <Route path="/accounting/trial-balance" element={<TrialBalance />} />
                    <Route path="/accounting/add-account" element={<AddAccount />} />
                    <Route path="/accounting/account/:id/edit" element={<EditAccount />} />
                    <Route path="/accounting/reconciliation" element={<Reconciliation />} />
                    <Route path="/accounting/adjust-opening-balance" element={<AdjustOpeningBalance />} />
                    <Route path="/accounting/tax-reports/create" element={<CreateTaxReport />} />
                    <Route path="/accounting/tax-reports/:id" element={<TaxReportDetail />} />
                    <Route path="/accounting/tax-reports" element={<TaxReports />} />
                    <Route path="/accounting/period-end" element={<PeriodEnd />} />
                    <Route path="/accounting/year-end-planner" element={<YearEndPlanner />} />
                    <Route path="/accounting/documents" element={<AccountingDocuments />} />
                    <Route path="/accounting/documents/:folderId" element={<AccountingDocuments />} />

                    {/* DMS Routes */}
                    <Route path="/dms/login" element={<DMSLogin />} />
                    <Route path="/dms/dashboard" element={<DMSDashboard />} />
                    <Route path="/dms/projects" element={<Projects />} />
                    <Route path="/dms/progress" element={<ProgressTracker />} />
                    <Route path="/dms/documents" element={<Documents />} />
                    <Route path="/dms/documents/:folderId" element={<Documents />} />
                    <Route path="/dms/tasks" element={<Tasks />} />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AnimatePresence>
              </BrowserRouter>
            </TooltipProvider>
          </QueryClientProvider>
        </TasksProvider>
      </ProjectsProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
