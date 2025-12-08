import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addEntity } from '@/lib/store/entities';
import { createEntity } from '@/lib/api/accounting';

const formSchema = z.object({
  type: z.enum(['Client', 'CDANT', 'Reinsurer']),
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['Active', 'Inactive']),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email({ message: 'Invalid email' }).optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  // Client
  vatNumber: z.string().optional(),
  creditTermsDays: z.coerce.number().min(0, 'Must be ≥ 0').optional(),
  outstanding: z.coerce.number().optional(),
  // CDANT
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  licenseNumber: z.string().optional(),
  // Reinsurer
  treatyTerms: z.string().optional(),
  rating: z.string().optional(),
  capacity: z.coerce.number().optional(),
  netPosition: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const AddEntity: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'Client',
      name: '',
      status: 'Active',
      currency: 'ZAR',
    },
  });

  const entityType = form.watch('type');

  function buildBackendNotes(values: FormValues): string | undefined {
    const parts: string[] = [];

    if (values.vatNumber) parts.push(`VAT: ${values.vatNumber}`);
    if (values.creditTermsDays !== undefined && values.creditTermsDays !== null && !Number.isNaN(values.creditTermsDays)) {
      parts.push(`Credit terms: ${values.creditTermsDays} days`);
    }
    if (values.outstanding !== undefined && values.outstanding !== null && !Number.isNaN(values.outstanding)) {
      parts.push(`Outstanding: ${values.outstanding}`);
    }
    if (values.commissionRate !== undefined && values.commissionRate !== null && !Number.isNaN(values.commissionRate)) {
      parts.push(`Commission rate: ${values.commissionRate}%`);
    }
    if (values.licenseNumber) parts.push(`License: ${values.licenseNumber}`);
    if (values.treatyTerms) parts.push(`Treaty terms: ${values.treatyTerms}`);
    if (values.rating) parts.push(`Rating: ${values.rating}`);
    if (values.capacity !== undefined && values.capacity !== null && !Number.isNaN(values.capacity)) {
      parts.push(`Capacity: ${values.capacity}`);
    }
    if (values.netPosition !== undefined && values.netPosition !== null && !Number.isNaN(values.netPosition)) {
      parts.push(`Net position: ${values.netPosition}`);
    }

    const extra = parts.length ? parts.join(' | ') : undefined;
    const baseNotes = values.notes && values.notes.trim().length > 0 ? values.notes.trim() : undefined;

    if (baseNotes && extra) return `${baseNotes} — ${extra}`;
    if (baseNotes) return baseNotes;
    if (extra) return extra;
    return undefined;
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        type: values.type,
        name: values.name,
        status: values.status,
        currency: values.currency,
        country: values.country,
        email: values.email,
        phone: values.phone,
        notes: buildBackendNotes(values),
      };

      await createEntity(payload);
      // Keep local store in sync so the Entities screen still works offline / without backend round-trips.
      addEntity(values as any);

      toast({ title: 'Entity saved', description: `${values.type} "${values.name}" added successfully.` });
      navigate('/entities');
    } catch (err: any) {
      console.error('Failed to save entity', err);
      toast({
        title: 'Failed to save entity',
        description: String(err?.message || err),
        variant: 'destructive',
      });
    }
  };

  const onSubmitAddAnother = async (values: FormValues) => {
    try {
      const payload = {
        type: values.type,
        name: values.name,
        status: values.status,
        currency: values.currency,
        country: values.country,
        email: values.email,
        phone: values.phone,
        notes: buildBackendNotes(values),
      };

      await createEntity(payload);
      addEntity(values as any);

      toast({ title: 'Entity saved', description: `${values.type} "${values.name}" added. You can add another.` });
      form.reset({ ...values, name: '', notes: '' });
    } catch (err: any) {
      console.error('Failed to save entity', err);
      toast({
        title: 'Failed to save entity',
        description: String(err?.message || err),
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Entity</h1>
          <Button variant="ghost" onClick={() => navigate('/entities')}>Back to Entities</Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Common Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Client">Client</SelectItem>
                            <SelectItem value="CDANT">CDANT</SelectItem>
                            <SelectItem value="Reinsurer">Reinsurer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Entity name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency (ISO 4217)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., USD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., South Africa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., +27 12 345 6789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., info@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Street, City, Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Additional notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Conditional Section */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {entityType === 'Client' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., ZA123456789" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="creditTermsDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Terms (days)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="outstanding"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outstanding</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 45000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {entityType === 'CDANT' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="commissionRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Rate (%)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 15" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., LIC-000123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="outstanding"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Payable</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 22500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {entityType === 'Reinsurer' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="treatyTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Treaty Terms</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Quota Share 40%" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., AM Best A-" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 1000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="netPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net Position</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., -35000 (Payable)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={form.handleSubmit(onSubmitAddAnother)}>
                Save & Add Another
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/entities')}>Cancel</Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </MainLayout>
  );
};

export default AddEntity;