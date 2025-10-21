import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const debitNoteSchema = z.object({
  issuedTo: z.string().min(1, 'Issued to is required'),
  issuedToAddress: z.string().min(1, 'Address is required'),
  insured: z.string().min(1, 'Insured is required'),
  coverType: z.string().min(1, 'Cover type is required'),
  policyRef: z.string().min(1, 'Policy reference is required'),
  periodFrom: z.string().min(1, 'Period start date is required'),
  periodTo: z.string().min(1, 'Period end date is required'),
  grossPremium: z.string().min(1, 'Gross premium is required'),
  ourSharePercentage: z.string().min(1, 'Our share percentage is required'),
  commissionPercentage: z.string().min(1, 'Commission percentage is required'),
  currency: z.string().min(1, 'Currency is required'),
  paymentTerms: z.string().min(1, 'Payment terms are required'),
  preparedBy: z.string().min(1, 'Prepared by is required'),
  notes: z.string().optional(),
});

type DebitNoteForm = z.infer<typeof debitNoteSchema>;

const CreateDebitNote = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<DebitNoteForm>({
    resolver: zodResolver(debitNoteSchema),
    defaultValues: {
      currency: 'USD',
      paymentTerms: '90 Days from the due date',
      commissionPercentage: '32.50',
    },
  });

  const grossPremium = parseFloat(form.watch('grossPremium') || '0');
  const ourSharePercentage = parseFloat(form.watch('ourSharePercentage') || '0');
  const commissionPercentage = parseFloat(form.watch('commissionPercentage') || '0');

  const ourShareAmount = (grossPremium * ourSharePercentage) / 100;
  const commissionAmount = (ourShareAmount * commissionPercentage) / 100;
  const netDue = ourShareAmount - commissionAmount;

  const onSubmit = (data: DebitNoteForm) => {
    console.log('Debit Note Data:', {
      ...data,
      calculations: {
        ourShareAmount,
        commissionAmount,
        netDue,
      },
    });

    toast({
      title: 'Debit Note Created',
      description: 'The debit note has been created successfully.',
    });

    navigate('/debit-credit-notes');
  };

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/debit-credit-notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Create Debit Note</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Entity Details */}
            <Card>
              <CardHeader>
                <CardTitle>Entity Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="issuedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issued To *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Waica Reinsurance Corporation PLC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="issuedToAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Full address of the entity"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insured *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MAAMBA COLLIERIES LIMITED (MCL)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Policy Details */}
            <Card>
              <CardHeader>
                <CardTitle>Policy Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="coverType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CONTRACTORS AND ERECTION ALL RISKS POLICY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyRef"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy Reference *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MCL/001/2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="periodFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period From *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="periodTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period To *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Premium Details */}
            <Card>
              <CardHeader>
                <CardTitle>Premium Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD - United States Dollar</SelectItem>
                          <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="grossPremium"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>100% Gross Premium *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ourSharePercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Our Share (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="10.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commissionPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reinsurance Commission (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="32.50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Calculations Display */}
                <div className="border-t pt-4 space-y-2 bg-muted/50 p-4 rounded-md">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Our Share Amount:</span>
                    <span className="text-sm">{form.watch('currency')} {ourShareAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Less Commission:</span>
                    <span className="text-sm text-destructive">-{form.watch('currency')} {commissionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Net Due From Entity:</span>
                    <span className="font-semibold text-lg">{form.watch('currency')} {netDue.toFixed(2)}</span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 90 Days from the due date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="preparedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prepared By *</FormLabel>
                      <FormControl>
                        <Input placeholder="Name of person preparing the note" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes or comments"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/debit-credit-notes')}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                Create Debit Note
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </MainLayout>
  );
};

export default CreateDebitNote;
