import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Role } from '@/lib/api/documents';
import { useDocumentContent, useSaveDocumentContent } from '@/hooks/useDocumentsQuery';
import { Loader2, ArrowLeft, Info } from 'lucide-react';

const DocumentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { folderId, documentId } = useParams<{ folderId: string; documentId: string }>();
  const [role, setRole] = useState<Role>('Editor');
  const [html, setHtml] = useState('');
  const [dirty, setDirty] = useState(false);

  const docId = Number(documentId || '0');
  const currentFolderId = Number(folderId || '1');

  useEffect(() => {
    const savedRole = localStorage.getItem('user-role') as Role | null;
    if (savedRole === 'Admin' || savedRole === 'Editor' || savedRole === 'Viewer') {
      setRole(savedRole);
    }
  }, []);

  const { data, isLoading, error } = useDocumentContent(docId, role);
  const saveMutation = useSaveDocumentContent(role);

  useEffect(() => {
    if (data && !dirty) {
      setHtml(data.html || '');
    }
  }, [data, dirty]);

  const handleBack = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    navigate(`/dms/documents/${currentFolderId}`);
  };

  const handleSave = () => {
    if (!data || !docId || !currentFolderId) return;

    saveMutation.mutate(
      {
        id: docId,
        folderId: currentFolderId,
        html,
        targetFormat: (data.ext || '').toLowerCase() === 'pdf' ? 'pdf' : 'docx',
      },
      {
        onSuccess: () => {
          setDirty(false);
          navigate(`/dms/documents/${currentFolderId}`);
        },
      }
    );
  };

  const disabled = isLoading || saveMutation.isPending;

  return (
    <DMSLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                {data?.name || 'Edit Document'}
              </h1>
              <p className="text-sm text-muted-foreground">
                In-app editor for documents in this folder
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={disabled || !html}
              className="gap-2"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>Save</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Document Content</span>
              {data && (
                <span className="text-xs text-muted-foreground">
                  {data.ext?.toUpperCase()} • Version {data.version}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              You can edit the text of this document inside the application. Layout and advanced
              formatting from the original file may not be preserved exactly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.conversionNote === 'pdf_to_text' && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4" />
                <p>
                  This PDF was converted to editable text. The saved PDF will contain the updated
                  text content but may not match the original page layout exactly.
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">
                Failed to load document content. Please try again.
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading document content...
              </div>
            ) : (
              <textarea
                className="w-full min-h-[400px] border border-border rounded-md p-3 text-sm font-sans resize-vertical focus:outline-none focus:ring-2 focus:ring-primary"
                value={html}
                onChange={(e) => {
                  setHtml(e.target.value);
                  setDirty(true);
                }}
                placeholder="Document content will appear here..."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DMSLayout>
  );
};

export default DocumentEditor;