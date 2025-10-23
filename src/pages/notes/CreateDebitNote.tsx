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
import mmfsLogo from '@/assets/mmfs-logo.jpg';

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
        {/* MMFS Branded Header */}
        <div className="relative bg-primary text-primary-foreground rounded-lg overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/90" />
          <div className="absolute right-0 top-0 h-full w-1/3 bg-secondary transform skew-x-[-15deg] origin-top-right" />
          
          <div className="relative p-6">
            <div className="flex items-center gap-6 mb-4">
              <img src={mmfsLogo} alt="MMFS Logo" className="h-16 w-auto object-contain bg-white/95 rounded-lg p-2 shadow-lg" />
              <div>
                <h1 className="text-3xl font-bold">Create Debit Note</h1>
                <p className="text-primary-foreground/90 mt-1">Marine Insurance Premium Adjustment</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/debit-credit-notes')}
              className="text-primary-foreground hover:bg-white/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Debit/Credit Notes
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Entity Details */}
            <Card className="border-t-4 border-t-secondary shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="text-primary flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded-full" />
                  Entity Details
                </CardTitle>
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
            <Card className="border-t-4 border-t-secondary shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="text-primary flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded-full" />
                  Policy Details
                </CardTitle>
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
            <Card className="border-t-4 border-t-secondary shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="text-primary flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded-full" />
                  Premium Details
                </CardTitle>
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
                <div className="border-t-2 border-t-secondary/20 pt-4 space-y-3 bg-gradient-to-br from-primary/5 to-secondary/5 p-5 rounded-lg shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Our Share Amount:</span>
                    <span className="text-base font-semibold">{form.watch('currency')} {ourShareAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Less Commission:</span>
                    <span className="text-base font-semibold text-destructive">-{form.watch('currency')} {commissionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-secondary/30 pt-3">
                    <span className="font-bold text-primary">Net Due From Entity:</span>
                    <span className="font-bold text-xl text-secondary">{form.watch('currency')} {netDue.toFixed(2)}</span>
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
            <Card className="border-t-4 border-t-secondary shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="text-primary flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded-full" />
                  Additional Information
                </CardTitle>
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
            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/debit-credit-notes')}
                className="border-primary/30 hover:bg-primary/5"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg hover:shadow-xl transition-all"
              >
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
