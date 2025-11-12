import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, Wand2, TableProperties, CheckCircle, Settings2 } from 'lucide-react';
import type { ImportMappingTemplate, NormalizedTransaction, DestinationSelection } from '@/lib/banking/models';
import { analyzeFile, createSession, saveTemplate, setSessionTemplate, stageFile, suggestField, getSession, editRow, excludeRows, computeFileHash } from '@/lib/banking/store';
import { parseAllRows } from '@/lib/banking/csv';
import * as bankingApi from '@/lib/api/banking';
import { getPrimaryRole } from '@/lib/api/auth';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFile?: File | null;
  initialDest?: DestinationSelection | null;
};

type AnalysisResult = Awaited<ReturnType<typeof analyzeFile>>;

const systemFields = [
  { label: 'Date', value: 'date' },
  { label: 'Description', value: 'description' },
  { label: 'Amount', value: 'amount' },
  { label: 'Debit', value: 'debit' },
  { label: 'Credit', value: 'credit' },
  { label: 'Account', value: 'accountCode' },
  { label: 'Reference', value: 'reference' },
  { label: 'Currency', value: 'currency' },
] as const;

export default function ImportWizard({ open, onOpenChange, initialFile = null, initialDest = null }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload'|'map'|'preview'|'dest'|'summary'|'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [bankName, setBankName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({});
  const [invertSigns, setInvertSigns] = useState(false);
  const [fixedCurrency, setFixedCurrency] = useState('');
  const [defaultAccountCode, setDefaultAccountCode] = useState('');
  const [rows, setRows] = useState<NormalizedTransaction[]>([]);
  const [dest, setDest] = useState<DestinationSelection>(initialDest ?? { journalEntries: true, trialBalance: false, chartOfAccounts: false });
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [backendSessionData, setBackendSessionData] = useState<any>(null);
  const totals = useMemo(() => getSessionTotals(sessionId, backendSessionData), [sessionId, backendSessionData, rows.length]);

  useEffect(() => {
    if (!open) {
      // reset when closing
      setStep('upload'); setFile(null); setAnalysis(null); setSessionId(null); setMapping({});
      setTemplateName(''); setBankName(''); setInvertSigns(false); setFixedCurrency(''); setDefaultAccountCode(''); setRows([]);
      setDest(initialDest ?? { journalEntries: true, trialBalance: false, chartOfAccounts: false });
      setIsAnalyzing(false); setUploadError(null); setIsCommitting(false); setCommitError(null);
      setIsStaging(false); setStagingError(null); setBackendSessionData(null);
    }
  }, [open, initialDest]);

  // If a file is provided externally, auto-select and progress to mapping
  useEffect(() => {
    if (open && initialFile && !file && step === 'upload') {
      onFileSelected(initialFile);
    }
  }, [open, initialFile, file, step]);

  // Keep destinations in sync if provided externally
  useEffect(() => {
    if (initialDest) setDest(initialDest);
  }, [initialDest]);

  async function onFileSelected(f: File) {
    // Reset errors
    setUploadError(null);
    setIsAnalyzing(true);

    try {
      // Validate file
      if (!f.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please select a CSV file');
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (f.size > MAX_FILE_SIZE) {
        throw new Error('File size must be less than 10MB');
      }

      // Set file and analyze locally first
      setFile(f);
      const res = await analyzeFile(f);
      setAnalysis(res);

      // Validate CSV has headers
      if (!res.headers || res.headers.length === 0) {
        throw new Error('CSV file has no headers. Please check file format.');
      }

      // Parse all rows for backend analysis
      const { rows: allRows } = await parseAllRows(f);

      if (allRows.length === 0) {
        throw new Error('CSV file has no data rows');
      }

      // Create session on backend
      const role = getPrimaryRole() || 'accountant';
      const fileHash = await computeFileHash(f);
      const backendSession = await bankingApi.createSession(
        {
          fileName: f.name,
          fileHash: fileHash,
          mappingTemplateId: null,
        },
        role
      );

      // Also create session in localStorage for local operations
      const localSession = await createSession(f, 'demo-user');
      setSessionId(String(backendSession.id));

      // Call backend API to analyze and compute totals
      const analyzeResponse = await bankingApi.analyzeSession(
        String(backendSession.id),
        {
          rows: allRows.map((row, index) => ({
            rowIndex: index,
            date: row.Date || row.date || null,
            description: row.Description || row.description || null,
            amount: parseFloat(row.Amount || row.amount || '0') || null,
            debit: parseFloat(row.Debit || row.debit || '0') || null,
            credit: parseFloat(row.Credit || row.credit || '0') || null,
            accountCode: row['Account Code'] || row.AccountCode || row['Account'] || null,
            reference: row.Reference || row.reference || null,
            currency: row.Currency || row.currency || null,
          })),
        },
        role
      );

      // Store backend session data with totals for display
      setBackendSessionData(analyzeResponse);

      // Initialize mapping suggestions
      const map: Record<string, string | undefined> = {};
      for (const h of res.headers) {
        map[h] = suggestField(h);
      }
      setMapping(map);

      // Success - move to mapping step
      toast({
        title: 'File uploaded successfully',
        description: `Analyzed ${allRows.length} rows from ${f.name}`,
      });

      setStep('map');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload file';
      setUploadError(errorMsg);
      toast({
        title: 'Upload failed',
        description: errorMsg,
        variant: 'destructive',
      });
      console.error('[ImportWizard] File upload error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function templateFromState(): Omit<ImportMappingTemplate, 'id'> {
    return {
      name: templateName || 'Unnamed Template',
      bank: bankName || 'Unknown Bank',
      headerMap: Object.fromEntries(Object.entries(mapping).filter(([_, v]) => !!v)) as Record<string, any>,
      transforms: {
        invertSigns,
        fixedCurrency: fixedCurrency || undefined,
        defaultAccountCode: defaultAccountCode || undefined,
      },
    };
  }

  async function stage() {
    if (!file || !sessionId) return;

    setStagingError(null);
    setIsStaging(true);

    try {
      // Save template locally
      const tmpl = saveTemplate(templateFromState());
      setSessionTemplate(sessionId, tmpl.id);

      // Stage rows locally
      const { rows: rowCount } = await stageFile(sessionId, file, tmpl);
      const sess = getSession(sessionId);
      setRows(sess.rows);

      // Call backend API to persist staged transactions
      const role = getPrimaryRole() || 'accountant';
      await bankingApi.stageTransactions(
        sessionId,
        {
          transactions: sess.rows.map((row) => ({
            rowIndex: row.rowIndex,
            date: row.date,
            description: row.description,
            amount: row.amount,
            debit: row.debit,
            credit: row.credit,
            accountCode: row.accountCode,
            reference: row.reference,
            currency: row.currency,
            validationStatus: row.validationStatus,
            duplicateFlag: row.duplicateFlag,
            excluded: row.excluded,
            editHistory: row.editHistory,
          })),
        },
        role
      );

      toast({
        title: 'Staging complete',
        description: `${rowCount} rows staged successfully`,
      });

      setStep('preview');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to stage rows';
      setStagingError(errorMsg);
      toast({
        title: 'Staging failed',
        description: errorMsg,
        variant: 'destructive',
      });
      console.error('[ImportWizard] Staging error:', error);
    } finally {
      setIsStaging(false);
    }
  }

  function updateCell(rowId: string, field: any, value: any) {
    if (!sessionId) return;
    editRow(sessionId, rowId, field, value);
    const sess = getSession(sessionId);
    setRows([...sess.rows]);
  }

  function toggleExclude(rowId: string, checked: boolean) {
    if (!sessionId) return;
    excludeRows(sessionId, [rowId], checked);
    const sess = getSession(sessionId);
    setRows([...sess.rows]);
  }

  async function commit() {
    if (!sessionId) return;

    setIsCommitting(true);
    setCommitError(null);

    try {
      const role = getPrimaryRole() || 'accountant';

      // Call backend API to commit the session
      const result = await bankingApi.commitSession(
        sessionId,
        {
          bankAccountCode: 'DEFAULT', // Default account code (not required for this flow)
          destinations: dest,
          aggregation: 'none',
        },
        role
      );

      if (result.success) {
        toast({
          title: 'Import committed',
          description: `Successfully committed ${result.committedRows} transactions to selected destinations`
        });
        setStep('done');
      } else {
        const errorMsg = result.errors.length > 0
          ? `${result.errors.length} validation errors occurred`
          : 'Commit failed';
        setCommitError(errorMsg);
        toast({
          title: 'Commit failed',
          description: errorMsg,
          variant: 'destructive'
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setCommitError(errorMsg);
      toast({
        title: 'Commit failed',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Banking CSV Import</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Steps</CardTitle>
                <CardDescription className="text-xs">Progress through the import</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <StepItem active={step==='upload'} icon={<Upload className="w-4 h-4" />} label="Upload" />
                  <StepItem active={step==='map'} icon={<Wand2 className="w-4 h-4" />} label="Mapping" />
                  <StepItem active={step==='preview'} icon={<TableProperties className="w-4 h-4" />} label="Preview" />
                  <StepItem active={step==='dest'} icon={<Settings2 className="w-4 h-4" />} label="Destinations" />
                  <StepItem active={step==='summary'} icon={<CheckCircle className="w-4 h-4" />} label="Summary" />
                </div>
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt>Rows</dt><dd>{totals?.count ?? 0}</dd>
                  <dt>Valid</dt><dd>{totals?.valid ?? 0}</dd>
                  <dt>Invalid</dt><dd>{totals?.invalid ?? 0}</dd>
                  <dt>Duplicates</dt><dd>{totals?.duplicate ?? 0}</dd>
                  <dt>Excluded</dt><dd>{totals?.excluded ?? 0}</dd>
                  <dt>Debit Total</dt><dd>{formatAmt(totals?.debitTotal ?? 0)}</dd>
                  <dt>Credit Total</dt><dd>{formatAmt(totals?.creditTotal ?? 0)}</dd>
                </dl>
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-3">
            {step === 'upload' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload CSV</CardTitle>
                  <CardDescription>Select your bank statement file</CardDescription>
                </CardHeader>
                <CardContent>
                  {uploadError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
                      {uploadError}
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        <span>Analyzing CSV file...</span>
                      </div>
                    </div>
                  )}
                  <Tabs defaultValue="csv">
                    <TabsList>
                      <TabsTrigger value="csv">CSV</TabsTrigger>
                      <TabsTrigger value="xls" disabled>Excel (coming)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="csv" className="mt-4">
                      <Input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={isAnalyzing}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onFileSelected(f);
                        }}
                      />
                      {file && !isAnalyzing && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Selected: {file.name}
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {step === 'map' && analysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Map Columns</CardTitle>
                  <CardDescription>Assign CSV headers to system fields</CardDescription>
                </CardHeader>
                <CardContent>
                  {stagingError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
                      {stagingError}
                    </div>
                  )}
                  {isStaging && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        <span>Staging rows...</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Template Name</label>
                      <Input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="e.g. FNB Checking" />
                    </div>
                    <div>
                      <label className="text-sm">Bank</label>
                      <Input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="e.g. First National Bank" />
                    </div>
                    <div>
                      <label className="text-sm">Fixed Currency</label>
                      <Input value={fixedCurrency} onChange={e=>setFixedCurrency(e.target.value.toUpperCase())} placeholder="e.g. USD" />
                    </div>
                    <div>
                      <label className="text-sm">Default Account Code</label>
                      <Input value={defaultAccountCode} onChange={e=>setDefaultAccountCode(e.target.value)} placeholder="e.g. 11001" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={invertSigns} onCheckedChange={(c:any)=>setInvertSigns(!!c)} />
                      <span className="text-sm">Invert signs (swap debit/credit)</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CSV Header</TableHead>
                          <TableHead>Map To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.headers.map(h => (
                          <TableRow key={h}>
                            <TableCell className="font-mono text-xs">{h}</TableCell>
                            <TableCell>
                              <Select value={mapping[h] || ''} onValueChange={(v)=>setMapping(prev => ({...prev, [h]: v}))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select field" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
                                  {systemFields.map(sf => (
                                    <SelectItem key={sf.value} value={sf.value}>{sf.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={stage} disabled={isStaging}>
                      {isStaging ? 'Staging...' : 'Stage Rows'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'preview' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview & Clean</CardTitle>
                  <CardDescription>Fix invalid rows, exclude duplicates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-[380px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Exclude</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Debit</TableHead>
                          <TableHead>Credit</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(r => (
                          <TableRow key={r.id} className={r.validationStatus==='invalid' ? 'bg-red-50' : r.duplicateFlag ? 'bg-yellow-50' : ''}>
                            <TableCell>
                              <Checkbox checked={r.excluded} onCheckedChange={(c:any)=>toggleExclude(r.id, !!c)} />
                            </TableCell>
                            <TableCell>
                              <Input value={r.date || ''} onChange={e=>updateCell(r.id,'date', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                              <Input value={r.description || ''} onChange={e=>updateCell(r.id,'description', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                              <Input value={r.amount ?? ''} onChange={e=>updateCell(r.id,'amount', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>{r.debit ?? ''}</TableCell>
                            <TableCell>{r.credit ?? ''}</TableCell>
                            <TableCell>
                              <Input value={r.accountCode || ''} onChange={e=>updateCell(r.id,'accountCode', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                              <Input value={r.reference || ''} onChange={e=>updateCell(r.id,'reference', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                              <Input value={r.currency || ''} onChange={e=>updateCell(r.id,'currency', e.target.value)} className="h-8" />
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{r.validationStatus}{r.duplicateFlag ? ' • dup' : ''}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Button variant="outline" onClick={()=>setStep('map')}>Back</Button>
                    <Button onClick={()=>setStep('dest')}>Continue</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'dest' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Destinations</CardTitle>
                  <CardDescription>Select where to commit imported entries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={dest.journalEntries} onCheckedChange={(c:any)=>setDest(d=>({...d, journalEntries: !!c}))} /> Journal Entries</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={dest.trialBalance} onCheckedChange={(c:any)=>setDest(d=>({...d, trialBalance: !!c}))} /> Trial Balance</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={dest.chartOfAccounts} onCheckedChange={(c:any)=>setDest(d=>({...d, chartOfAccounts: !!c}))} /> Chart of Accounts</label>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Button variant="outline" onClick={()=>setStep('preview')}>Back</Button>
                    <Button onClick={()=>setStep('summary')}>Continue</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'summary' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                  <CardDescription>Review and confirm commit</CardDescription>
                </CardHeader>
                <CardContent>
                  {commitError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
                      {commitError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>Rows</div><div>{totals?.count ?? 0}</div>
                    <div>Valid</div><div>{totals?.valid ?? 0}</div>
                    <div>Invalid</div><div>{totals?.invalid ?? 0}</div>
                    <div>Duplicates</div><div>{totals?.duplicate ?? 0}</div>
                    <div>Excluded</div><div>{totals?.excluded ?? 0}</div>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Button variant="outline" onClick={()=>setStep('dest')} disabled={isCommitting}>Back</Button>
                    <Button onClick={commit} disabled={isCommitting}>
                      {isCommitting ? 'Committing...' : 'Commit Import'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'done' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Import Completed</CardTitle>
                  <CardDescription>Your import has been committed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end">
                    <Button onClick={()=>onOpenChange(false)}>Close</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepItem({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${active ? 'bg-sage-lightGray' : ''}`}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function getSessionTotals(sessionId: string | null, backendData: any) {
  if (!sessionId) return null;

  // If we have backend session data with totals, use that
  if (backendData?.totals) {
    return backendData.totals;
  }

  // Fallback to localStorage session (with null safety)
  try {
    const s = getSession(sessionId);
    return s?.session?.totals ?? null;
  } catch (error) {
    // Session not found in localStorage - return null gracefully
    return null;
  }
}

function formatAmt(n: number) { return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }); }