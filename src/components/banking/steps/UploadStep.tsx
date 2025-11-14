import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = {
  file: File | null;
  isAnalyzing: boolean;
  uploadError: string | null;
  onFileSelected: (file: File) => void;
};

export default function UploadStep({ file, isAnalyzing, uploadError, onFileSelected }: Props) {
  return (
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
  );
}
