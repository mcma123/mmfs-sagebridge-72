import React, { useEffect, useState } from 'react';
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
import { getEntities, deleteEntity, type EntityDTO } from '@/lib/api/accounting';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getRolesFromToken } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';

const Entities = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [entities, setEntities] = useState<EntityDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selected, setSelected] = useState<EntityDTO | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const roles = getRolesFromToken();
  const canDelete = roles.includes('admin') || roles.includes('accountant');

  const fetchEntities = async () => {
    try {
      setIsLoading(true);
      const resp = await getEntities();
      setEntities(resp.items || []);
    } catch (err: any) {
      toast({
        title: 'Failed to load entities',
        description: err.message || 'Could not fetch entities from the server.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const clients = entities.filter(e => e.type === 'Client');
  const cdants = entities.filter(e => e.type === 'CDANT');
  const reinsurers = entities.filter(e => e.type === 'Reinsurer');

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteEntity(confirmDeleteId);
      toast({ title: 'Entity deleted', description: 'The entity has been removed.' });
      fetchEntities(); // Refresh list
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err.message || 'Could not delete the entity. It may be in use.',
        variant: 'destructive',
      });
    } finally {
      setConfirmDeleteId(null);
    }
  };

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
              Clients ({clients.length})
            </TabsTrigger>
            <TabsTrigger value="cdants">
              <Users className="h-4 w-4 mr-2" />
              CDANTs ({cdants.length})
            </TabsTrigger>
            <TabsTrigger value="reinsurers">
              <Shield className="h-4 w-4 mr-2" />
              Reinsurers ({reinsurers.length})
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
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.length === 0 && !isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No clients found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clients
                        .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(client => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium">{client.name}</TableCell>
                            <TableCell>{client.currency || 'ZAR'}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {client.notes ? (client.notes.length > 50 ? client.notes.substring(0, 50) + '...' : client.notes) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={client.status === 'Active' ? "bg-green-50 text-green-700" : "bg-gray-100"}>
                                {client.status || 'Active'}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setSelected(client)}>View</Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(client.id)}>Delete</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
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
                      <TableHead>Contact</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cdants.length === 0 && !isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No CDANTs found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cdants.map(cdant => (
                        <TableRow key={cdant.id}>
                          <TableCell className="font-medium">{cdant.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs">
                              {cdant.email && <span>{cdant.email}</span>}
                              {cdant.phone && <span>{cdant.phone}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {cdant.notes ? (cdant.notes.length > 50 ? cdant.notes.substring(0, 50) + '...' : cdant.notes) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cdant.status === 'Active' ? "bg-green-50 text-green-700" : "bg-gray-100"}>
                              {cdant.status || 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelected(cdant)}>View</Button>
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(cdant.id)}>Delete</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
                      <TableHead>Country</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reinsurers.length === 0 && !isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No Reinsurers found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reinsurers.map(reinsurer => (
                        <TableRow key={reinsurer.id}>
                          <TableCell className="font-medium">{reinsurer.name}</TableCell>
                          <TableCell>{reinsurer.country || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {reinsurer.notes ? (reinsurer.notes.length > 50 ? reinsurer.notes.substring(0, 50) + '...' : reinsurer.notes) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={reinsurer.status === 'Active' ? "bg-green-50 text-green-700" : "bg-gray-100"}>
                              {reinsurer.status || 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelected(reinsurer)}>View</Button>
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeleteId(reinsurer.id)}>Delete</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
              This action will remove the entity including from the database. This action cannot be undone.
              Note: If this entity is used in existing journals, deletion will be blocked by the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
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
