import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Building2, Users, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { listEntities, type ClientEntity, type CdantEntity, type ReinsurerEntity } from '@/lib/store/entities';

// Store-derived lists (computed within component for fresh data)

const Entities = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const clients = listEntities('Client') as ClientEntity[];
  const cdants = listEntities('CDANT') as CdantEntity[];
  const reinsurers = listEntities('Reinsurer') as ReinsurerEntity[];

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Entity Management</h1>
          <Button onClick={() => navigate('/entities/add')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entity
          </Button>
        </div>
        
        <Tabs defaultValue="clients" className="w-full">
          <TabsList>
            <TabsTrigger value="clients">
              <Building2 className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="cdants">
              <Users className="h-4 w-4 mr-2" />
              CDANTs
            </TabsTrigger>
            <TabsTrigger value="reinsurers">
              <Shield className="h-4 w-4 mr-2" />
              Reinsurers
            </TabsTrigger>
          </TabsList>
          
          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Client Portfolio</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
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
                      <TableHead>Client Name</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Outstanding Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients
                      .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(client => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.currency || 'ZAR'}</TableCell>
                        <TableCell className="text-amber-600">
                          {(client.currency || 'ZAR')} {Number(client.outstanding || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {client.status}
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
          
          {/* CDANTs Tab */}
          <TabsContent value="cdants" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Commercial Direct Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CDANT Name</TableHead>
                      <TableHead>Commission Rate</TableHead>
                      <TableHead>Commission Payable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cdants.map(cdant => (
                      <TableRow key={cdant.id}>
                        <TableCell className="font-medium">{cdant.name}</TableCell>
                        <TableCell>{Number(cdant.commissionRate || 0)}%</TableCell>
                        <TableCell className="text-red-600">
                          {(cdant.currency || 'ZAR')} {Number(cdant.outstanding || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {cdant.status}
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
          
          {/* Reinsurers Tab */}
          <TabsContent value="reinsurers" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Reinsurance Partners</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reinsurer Name</TableHead>
                      <TableHead>Treaty Terms</TableHead>
                      <TableHead>Net Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reinsurers.map(reinsurer => (
                      <TableRow key={reinsurer.id}>
                        <TableCell className="font-medium">{reinsurer.name}</TableCell>
                        <TableCell>{reinsurer.treatyTerms}</TableCell>
                        <TableCell className="text-green-600">
                          {(reinsurer.currency || 'USD')} {Math.abs(Number(reinsurer.netPosition ?? 0)).toLocaleString()} (Payable)
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {reinsurer.status}
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

export default Entities;
