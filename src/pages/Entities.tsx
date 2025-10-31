import React, { useMemo, useState } from 'react';
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
import { listEntities, removeEntity, type BaseEntity, type ClientEntity, type CdantEntity, type ReinsurerEntity } from '@/lib/store/entities';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getRolesFromToken } from '@/lib/api/auth';

// Store-derived lists (computed within component for fresh data)

const Entities = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const [refreshTick, setRefreshTick] = useState(0);
  const clients = useMemo(() => listEntities('Client') as ClientEntity[], [refreshTick]);
  const cdants = useMemo(() => listEntities('CDANT') as CdantEntity[], [refreshTick]);
  const reinsurers = useMemo(() => listEntities('Reinsurer') as ReinsurerEntity[], [refreshTick]);

  const [selected, setSelected] = useState<BaseEntity | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const roles = getRolesFromToken();
  const canDelete = roles.includes('admin') || roles.includes('accountant');

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
                        <TableCell className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(client)}>View</Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(String(client.id))}>Delete</Button>
                          )}
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
                        <TableCell className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(cdant)}>View</Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(String(cdant.id))}>Delete</Button>
                          )}
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
                        <TableCell className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(reinsurer)}>View</Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(String(reinsurer.id))}>Delete</Button>
                          )}
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
      {/* View Entity Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.type} • {selected?.status || 'Active'} • {selected?.currency || 'ZAR'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {selected?.country && (<div><span className="text-muted-foreground">Country:</span> {selected.country}</div>)}
            {selected?.email && (<div><span className="text-muted-foreground">Email:</span> {selected.email}</div>)}
            {selected?.phone && (<div><span className="text-muted-foreground">Phone:</span> {selected.phone}</div>)}
            {selected?.notes && (<div><span className="text-muted-foreground">Notes:</span> {selected.notes}</div>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entity?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the entity from your local list. If the entity exists in accounting and is referenced by journals, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) {
                  removeEntity(confirmDeleteId);
                  setConfirmDeleteId(null);
                  setRefreshTick((t) => t + 1);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Entities;
