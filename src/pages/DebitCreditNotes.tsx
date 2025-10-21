import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Sample data
const debitNotes = [
  { 
    id: 'DN-2024-001', 
    date: '2024-01-15', 
    entityType: 'Client', 
    entityName: 'Oceanic Shipping Ltd',
    policyRef: 'MC-2024-0123',
    reason: 'Additional premium charge',
    amount: 5000,
    currency: 'USD',
    status: 'Issued'
  },
  { 
    id: 'DN-2024-002', 
    date: '2024-01-18', 
    entityType: 'CDANT', 
    entityName: 'Marine Brokers PTY',
    policyRef: 'MH-2024-0456',
    reason: 'Commission adjustment',
    amount: 1200,
    currency: 'ZAR',
    status: 'Applied'
  },
];

const creditNotes = [
  { 
    id: 'CN-2024-001', 
    date: '2024-01-12', 
    entityType: 'Client', 
    entityName: 'Coastal Freight SA',
    policyRef: 'MC-2024-0089',
    reason: 'Premium refund - policy cancelled',
    amount: 8500,
    currency: 'ZAR',
    status: 'Issued'
  },
  { 
    id: 'CN-2024-002', 
    date: '2024-01-20', 
    entityType: 'Reinsurer', 
    entityName: 'Global Reinsurance Corp',
    policyRef: 'MC-2024-0134',
    reason: 'Claim adjustment',
    amount: 3500,
    currency: 'USD',
    status: 'Draft'
  },
];

const DebitCreditNotes = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Debit & Credit Notes</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/notes/debit/new')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              New Debit Note
            </Button>
            <Button onClick={() => navigate('/notes/credit/new')}>
              <TrendingDown className="h-4 w-4 mr-2" />
              New Credit Note
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="debit" className="w-full">
          <TabsList>
            <TabsTrigger value="debit">
              <TrendingUp className="h-4 w-4 mr-2" />
              Debit Notes
            </TabsTrigger>
            <TabsTrigger value="credit">
              <TrendingDown className="h-4 w-4 mr-2" />
              Credit Notes
            </TabsTrigger>
          </TabsList>
          
          {/* Debit Notes Tab */}
          <TabsContent value="debit" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Debit Notes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search debit notes..."
                      className="w-[250px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debitNotes.map(note => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.id}</TableCell>
                        <TableCell>{note.date}</TableCell>
                        <TableCell>{note.entityType}</TableCell>
                        <TableCell>{note.entityName}</TableCell>
                        <TableCell>{note.policyRef}</TableCell>
                        <TableCell>{note.reason}</TableCell>
                        <TableCell className="text-red-600">
                          {note.currency} {note.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              note.status === 'Applied' 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-blue-50 text-blue-700'
                            }
                          >
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Credit Notes Tab */}
          <TabsContent value="credit" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Credit Notes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search credit notes..."
                      className="w-[250px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Policy Ref</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map(note => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.id}</TableCell>
                        <TableCell>{note.date}</TableCell>
                        <TableCell>{note.entityType}</TableCell>
                        <TableCell>{note.entityName}</TableCell>
                        <TableCell>{note.policyRef}</TableCell>
                        <TableCell>{note.reason}</TableCell>
                        <TableCell className="text-green-600">
                          {note.currency} {note.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              note.status === 'Applied' 
                                ? 'bg-green-50 text-green-700' 
                                : note.status === 'Draft'
                                ? 'bg-gray-50 text-gray-700'
                                : 'bg-blue-50 text-blue-700'
                            }
                          >
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MainLayout>
  );
};

export default DebitCreditNotes;
