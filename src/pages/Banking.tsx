import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp } from 'lucide-react';
import ImportWizard from '@/components/banking/ImportWizard';
import { listSessions } from '@/lib/banking/store';
import type { ImportSession } from '@/lib/banking/models';
import type { DestinationSelection } from '@/lib/banking/models';

const Banking: React.FC = () => {
  const [importOpen, setImportOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<ImportSession[]>([]);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [destPrefs, setDestPrefs] = React.useState<DestinationSelection>({ journalEntries: true, trialBalance: false, chartOfAccounts: false });

  React.useEffect(() => {
    // Refresh sessions whenever the wizard opens/closes
    setSessions(listSessions());
  }, [importOpen]);

  return (
    <MainLayout>
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Banking Import</h1>
            <p className="text-muted-foreground">Import CSV statements and commit to accounting destinations</p>
          </div>
          <div>
            <Button onClick={() => setImportOpen(true)} className="bg-primary-500 hover:bg-primary-600 text-white inline-flex items-center">
              <FileUp size={16} className="mr-2" />
              Start CSV Import
            </Button>
          </div>
        </div>

        {/* Upload CSV */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload CSV</CardTitle>
            <CardDescription>Pick a CSV file to start the import</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sage-lightGray file:text-muted-foreground hover:file:bg-sage-lightGray/70"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setPendingFile(f); setImportOpen(true); }
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">CSV only for now. Excel support coming soon.</p>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Commit Destinations</div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={destPrefs.journalEntries}
                      onChange={(e)=> setDestPrefs(d => ({ ...d, journalEntries: e.target.checked }))}
                    />
                    Journal Entries
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={destPrefs.trialBalance}
                      onChange={(e)=> setDestPrefs(d => ({ ...d, trialBalance: e.target.checked }))}
                    />
                    Trial Balance
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={destPrefs.chartOfAccounts}
                      onChange={(e)=> setDestPrefs(d => ({ ...d, chartOfAccounts: e.target.checked }))}
                    />
                    Chart of Accounts
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">These preferences prefill the wizard’s Destinations step.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
            <CardDescription>Aligned with the Banking CSV Import plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Upload CSV file.</li>
              <li>Map CSV columns to system fields.</li>
              <li>Preview rows, fix errors, exclude duplicates.</li>
              <li>Select destinations: Journal Entries, Trial Balance, Chart of Accounts.</li>
              <li>Review summary and confirm commit.</li>
              <li>View results and audit log.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Recent Import Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Import Sessions</CardTitle>
            <CardDescription>Local staging sessions from CSV imports</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet. Use “Start CSV Import”.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b border-sage-lightGray">
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium">File</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Rows</th>
                      <th className="pb-3 font-medium text-right">Debit</th>
                      <th className="pb-3 font-medium text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-sage-lightGray/50">
                        <td className="py-3 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="py-3 text-sm">{s.fileName}</td>
                        <td className="py-3 text-sm">{s.status}</td>
                        <td className="py-3 text-sm text-right">{s.totals.count}</td>
                        <td className="py-3 text-sm text-right">R{(s.totals.debitTotal || 0).toLocaleString()}</td>
                        <td className="py-3 text-sm text-right">R{(s.totals.creditTotal || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wizard */}
        <ImportWizard
          open={importOpen}
          onOpenChange={(o) => { setImportOpen(o); if (!o) setPendingFile(null); setSessions(listSessions()); }}
          initialFile={pendingFile || null}
          initialDest={destPrefs}
        />
      </motion.div>
    </MainLayout>
  );
};

export default Banking;
