import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Role, DocxContent, DocxParagraphBlock } from '@/lib/api/documents';
import { useDocumentContent, useSaveDocumentContent } from '@/hooks/useDocumentsQuery';
import { Loader2, ArrowLeft, Info } from 'lucide-react';

const DocumentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { folderId, documentId } = useParams<{ folderId: string; documentId: string }>();
  const [role, setRole] = useState<Role>('Editor');
  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
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
      // For DOCX documents, backend returns structured docx content.
      setDocxContent(data.docx ?? { blocks: [] });
    }
  }, [data, dirty]);

  const handleParagraphChange = (blockId: string, value: string) => {
    setDocxContent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((block) =>
          block.type === 'paragraph' && block.id === blockId
            ? { ...block, text: value }
            : block
        ),
      };
    });
    setDirty(true);
  };

  const handleDeleteParagraph = (blockId: string) => {
    setDocxContent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.filter(
          (block) => !(block.type === 'paragraph' && block.id === blockId)
        ),
      };
    });
    setDirty(true);
  };

  const handleAddParagraph = () => {
    setDocxContent((prev) => {
      const base: DocxContent = prev ?? { blocks: [] };
      const newBlock: DocxParagraphBlock = {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'paragraph',
        path: null,
        text: '',
      };
      return {
        ...base,
        blocks: [...base.blocks, newBlock],
      };
    });
    setDirty(true);
  };

  const handleCellChange = (cellId: string, value: string) => {
    setDocxContent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((block) => {
          if (block.type !== 'table') return block;
          const rows = block.rows.map((row) => ({
            cells: row.cells.map((cell) =>
              cell.id === cellId ? { ...cell, text: value } : cell
            ),
          }));
          return { ...block, rows };
        }),
      };
    });
    setDirty(true);
  };

  const handleBack = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    navigate(`/dms/documents/${currentFolderId}`);
  };

  const handleSave = () => {
    if (!data || !docId || !currentFolderId || !docxContent) return;

    saveMutation.mutate(
      {
        id: docId,
        folderId: currentFolderId,
        docx: docxContent,
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
              disabled={disabled || !docxContent}
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
              Edit the plain text content of this DOCX document. Paragraphs and table cells are
              editable here; all other formatting, images, and layout are preserved in the
              underlying file but not shown in this simplified editor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-destructive">
                Failed to load document content. Please try again.
              </div>
            )}

            {docxContent && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4" />
                <p>
                  You are editing DOCX text only. Headers, footers, images, and detailed
                  formatting are preserved but not displayed in this view.
                </p>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading document content...
              </div>
            ) : !docxContent ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                No editable DOCX content is available for this document.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {docxContent.blocks.map((block, index) => {
                    if (block.type === 'paragraph') {
                      return (
                        <div
                          key={block.id}
                          className="border border-border rounded-md p-3 space-y-2 bg-background"
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Paragraph {index + 1}</span>
                            <div className="space-x-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => handleDeleteParagraph(block.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <textarea
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono resize-y min-h-[60px]"
                            value={block.text}
                            onChange={(e) => handleParagraphChange(block.id, e.target.value)}
                            placeholder="Empty paragraph"
                          />
                        </div>
                      );
                    }

                    // Table block
                    return (
                      <div
                        key={block.id}
                        className="border border-border rounded-md p-3 space-y-2 bg-background"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Table {index + 1}</span>
                        </div>
                        <div className="overflow-auto">
                          <table className="w-full border-collapse text-sm">
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.cells.map((cell) => (
                                    <td
                                      key={cell.id}
                                      className="border border-border align-top p-1"
                                    >
                                      <textarea
                                        className="w-full border-none bg-transparent text-xs font-mono resize-y min-h-[40px]"
                                        value={cell.text}
                                        onChange={(e) => handleCellChange(cell.id, e.target.value)}
                                        placeholder="Empty cell"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddParagraph}
                  className="mt-2"
                >
                  Add paragraph
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DMSLayout>
  );
};

export default DocumentEditor;