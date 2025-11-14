import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';
import type { ImportMappingTemplate, NormalizedTransaction, DestinationSelection } from '@/lib/banking/models';
import { analyzeFile, createSession, saveTemplate, setSessionTemplate, stageFile, suggestField, getSession, editRow, excludeRows, computeFileHash } from '@/lib/banking/store';
import { parseAllRows } from '@/lib/banking/csv';
import * as bankingApi from '@/lib/api/banking';
import { getPrimaryRole } from '@/lib/api/auth';
import WizardSidebar from '@/components/banking/WizardSidebar';
import WizardLayout from '@/components/banking/WizardLayout';
import UploadStep from '@/components/banking/steps/UploadStep';
import MappingStep from '@/components/banking/steps/MappingStep';
import PreviewStep from '@/components/banking/steps/PreviewStep';
import DestinationsStep from '@/components/banking/steps/DestinationsStep';
import SummaryStep from '@/components/banking/steps/SummaryStep';
import CompletionStep from '@/components/banking/steps/CompletionStep';

type StepType = 'upload' | 'map' | 'preview' | 'dest' | 'summary' | 'done';
type AnalysisResult = Awaited<ReturnType<typeof analyzeFile>>;

export default function ImportWizard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { initialFile, initialDest } = (location.state as any) || {};

  const [step, setStep] = useState<StepType>('upload');
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

  // If a file is provided externally, auto-select and progress to mapping
  useEffect(() => {
    if (initialFile && !file && step === 'upload') {
      onFileSelected(initialFile);
    }
  }, [initialFile]);

  async function onFileSelected(f: File) {
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
      setSessionId(localSession.id); // Use localStorage session ID for consistency

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
          bankAccountCode: 'DEFAULT',
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

  function handleClose() {
    navigate('/banking', { state: { importCompleted: true, sessionId } });
  }

  function handleCancel() {
    navigate('/banking');
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Banking CSV Import</h1>
          <button
            onClick={handleCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel & Return
          </button>
        </div>
        <p className="text-muted-foreground">Import and map CSV bank statements to your accounting system</p>
      </div>

      <WizardLayout
        sidebar={<WizardSidebar currentStep={step} totals={totals} />}
      >
        {step === 'upload' && (
          <UploadStep
            file={file}
            isAnalyzing={isAnalyzing}
            uploadError={uploadError}
            onFileSelected={onFileSelected}
          />
        )}

        {step === 'map' && analysis && (
          <MappingStep
            analysis={analysis}
            templateName={templateName}
            setTemplateName={setTemplateName}
            bankName={bankName}
            setBankName={setBankName}
            fixedCurrency={fixedCurrency}
            setFixedCurrency={setFixedCurrency}
            defaultAccountCode={defaultAccountCode}
            setDefaultAccountCode={setDefaultAccountCode}
            invertSigns={invertSigns}
            setInvertSigns={setInvertSigns}
            mapping={mapping}
            setMapping={setMapping}
            isStaging={isStaging}
            stagingError={stagingError}
            onStage={stage}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            rows={rows}
            updateCell={updateCell}
            toggleExclude={toggleExclude}
            onBack={() => setStep('map')}
            onContinue={() => setStep('dest')}
          />
        )}

        {step === 'dest' && (
          <DestinationsStep
            dest={dest}
            setDest={setDest}
            onBack={() => setStep('preview')}
            onContinue={() => setStep('summary')}
          />
        )}

        {step === 'summary' && (
          <SummaryStep
            totals={totals}
            isCommitting={isCommitting}
            commitError={commitError}
            onBack={() => setStep('dest')}
            onCommit={commit}
          />
        )}

        {step === 'done' && (
          <CompletionStep onClose={handleClose} />
        )}
      </WizardLayout>
    </MainLayout>
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
