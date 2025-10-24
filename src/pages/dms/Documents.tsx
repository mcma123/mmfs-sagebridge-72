import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Search, FolderOpen, FileText, Download, Eye, Trash2, Filter } from 'lucide-react';

const Documents: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const folders = [
    { id: '01', name: '01_Submission', count: 12, color: 'bg-blue-500' },
    { id: '02', name: '02_Marketing', count: 8, color: 'bg-purple-500' },
    { id: '03', name: '03_Quotations', count: 15, color: 'bg-green-500' },
    { id: '04', name: '04_Binding', count: 6, color: 'bg-yellow-500' },
    { id: '05', name: '05_Contracts', count: 10, color: 'bg-red-500' },
    { id: '06', name: '06_Premium', count: 7, color: 'bg-indigo-500' },
    { id: '07', name: '07_Claims', count: 3, color: 'bg-pink-500' },
    { id: '08', name: '08_Correspondence', count: 24, color: 'bg-orange-500' },
  ];

  const mockDocuments = [
    {
      name: 'Placement_Slip_Maamba_v2.0.pdf',
      size: '2.4 MB',
      type: 'PDF',
      uploadedBy: 'TK',
      uploadDate: '2025-01-20',
      version: 'v2.0',
      category: '02_Marketing',
    },
    {
      name: 'Quote_Munich_Re.xlsx',
      size: '856 KB',
      type: 'Excel',
      uploadedBy: 'JD',
      uploadDate: '2025-01-19',
      version: 'v1.0',
      category: '03_Quotations',
    },
    {
      name: 'Cover_Note_Final.docx',
      size: '1.2 MB',
      type: 'Word',
      uploadedBy: 'SM',
      uploadDate: '2025-01-18',
      version: 'v1.1',
      category: '04_Binding',
    },
    {
      name: 'Debit_Note_N1025.016.pdf',
      size: '345 KB',
      type: 'PDF',
      uploadedBy: 'TK',
      uploadDate: '2025-01-17',
      version: 'v1.0',
      category: '06_Premium',
    },
  ];

  const getFileIcon = (type: string) => {
    return <FileText className="h-5 w-5" />;
  };

  const getFileColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'text-red-600';
      case 'excel':
        return 'text-green-600';
      case 'word':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <DMSLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Document Management</h1>
            <p className="text-muted-foreground mt-1">Organize and manage project documents</p>
          </div>
          <Button className="bg-secondary hover:bg-secondary/90 gap-2">
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents by name, category, or uploader..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Folders */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Document Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                      selectedFolder === folder.id
                        ? 'bg-secondary text-white'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${folder.color}`} />
                      <span className="text-sm font-medium">{folder.name}</span>
                    </div>
                    <Badge variant={selectedFolder === folder.id ? 'secondary' : 'outline'}>
                      {folder.count}
                    </Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Documents */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockDocuments.map((doc, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={getFileColor(doc.type)}>
                          {getFileIcon(doc.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{doc.size}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Badge variant="outline" className="text-xs">{doc.version}</Badge>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{doc.uploadDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-white text-xs">
                              {doc.uploadedBy}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button size="icon" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="border-2 border-dashed border-muted rounded-lg p-12 text-center hover:border-secondary transition-colors cursor-pointer">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drag and drop files here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </DMSLayout>
  );
};

export default Documents;
