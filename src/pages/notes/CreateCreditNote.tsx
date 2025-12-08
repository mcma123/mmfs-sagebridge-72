import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mmfsLogo from '@/assets/mmfs-logo.jpg';
import { getEntities, getAccounts, postJournal, applyCredit, type AccountDTO, type EntityDTO } from '@/lib/api/accounting';
import { buildCreditJournal, type CreditNoteFormInput } from '@/lib/accounting/notes';
import { getAccountingDefaults, saveAccountingDefaults } from '@/lib/store/accountingSettings';

const creditNoteSchema = z.object({
  issuedTo: z.string().min(1, 'Issued to is required'),
  issuedToAddress: z.string().min(1, 'Address is required'),
  retroCedant: z.string().optional(),
  insured: z.string().min(1, 'Insured is required'),
  coverType: z.string().min(1, 'Cover type is required'),
  policyRef: z.string().min(1, 'Policy reference is required'),
  periodFrom: z.string().min(1, 'Period start date is required'),
  periodTo: z.string().min(1, 'Period end date is required'),
  grossPremium: z.string().min(1, 'Gross premium is required'),
  yourSharePercentage: z.string().min(1, 'Your share percentage is required'),
  deductionPercentage: z.string().min(1, 'Deduction percentage is required'),
  currency: z.string().min(1, 'Currency is required'),
  paymentTerms: z.string().min(1, 'Payment terms are required'),
  preparedBy: z.string().min(1, 'Prepared by is required'),
  notes: z.string().optional(),
});

type CreditNoteForm = z.infer<typeof creditNoteSchema>;

const CreateCreditNote = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const search = new URLSearchParams(location.search);
  const parentDebitNoteId = search.get('debitId') ? Number(search.get('debitId')) : null;

  const [entities, setEntities] = React.useState<EntityDTO[]>([]);
  const [accounts, setAccounts] = React.useState<AccountDTO[]>([]);
  const defaults = React.useMemo(() => getAccountingDefaults(), []);
  const [selectedEntityId, setSelectedEntityId] = React.useState<number | null>(null);
  const [apAccountId, setApAccountId] = React.useState<number | null>(defaults.apAccountId ?? null);
  const [premiumRefundAccountId, setPremiumRefundAccountId] = React.useState<number | null>(defaults.premiumRefundAccountId ?? null);
  const [deductionIncomeAccountId, setDeductionIncomeAccountId] = React.useState<number | null>(defaults.deductionIncomeAccountId ?? null);

  React.useEffect(() => {
    (async () => {
      try {
        const [entitiesResp, accountsResp] = await Promise.all([getEntities(), getAccounts()]);
        setEntities(entitiesResp.items || []);
        setAccounts(accountsResp.items || []);
      } catch (err: any) {
        toast({ title: 'Failed to load accounting data', description: String(err?.message || err) });
      }
    })();
  }, [toast]);

  const form = useForm<CreditNoteForm>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      currency: 'USD',
      paymentTerms: '90 Days from the due date',
      deductionPercentage: '35.00',
    },
  });

  const grossPremium = parseFloat(form.watch('grossPremium') || '0');
  const yourSharePercentage = parseFloat(form.watch('yourSharePercentage') || '0');
  const deductionPercentage = parseFloat(form.watch('deductionPercentage') || '0');

  const yourShareAmount = (grossPremium * yourSharePercentage) / 100;
  const deductionAmount = (yourShareAmount * deductionPercentage) / 100;
  const netDueToYou = yourShareAmount - deductionAmount;

  const onSubmit = async (data: CreditNoteForm) => {
    try {
      if (!apAccountId || !premiumRefundAccountId || !deductionIncomeAccountId) {
        toast({ title: 'Missing account selections', description: 'Please select AP, Premium Refund, and Deduction Income accounts.' });
        return;
      }

      const postDateISO = new Date().toISOString().slice(0, 10);
      const formInput = data as unknown as CreditNoteFormInput;
      const payload = buildCreditJournal(
        formInput,
        selectedEntityId ?? null,
        {
          apAccountId,
          premiumRefundAccountId,
          deductionIncomeAccountId,
        },
        postDateISO,
      );

      const resp = await postJournal(payload, 'accountant', 1);
      // Save defaults for next time
      saveAccountingDefaults({
        apAccountId,
        premiumRefundAccountId,
        deductionIncomeAccountId,
      });

      toast({
        title: 'Credit Note Posted',
        description: `Journal #${resp.journal_id} created successfully.`,
      });

      // If we were launched from a specific debit note, automatically apply this credit
      // only when there is a positive net amount to apply. For zero-net credit notes,
      // we still navigate back to the wizard but skip the application to avoid DB errors.
      if (parentDebitNoteId && netDueToYou > 0) {
        try {
          await applyCredit(
            resp.journal_id,
            {
              debit_note_id: parentDebitNoteId,
              amount: netDueToYou,
              applied_date: postDateISO,
            },
            'accountant',
            1,
          );

          toast({
            title: 'Credit Applied',
            description: `Credit note applied to debit note #${parentDebitNoteId}.`,
          });
        } catch (applyErr: any) {
          console.error('Failed to apply credit automatically', applyErr);
          toast({
            title: 'Credit note created but not applied',
            description: String(applyErr?.message || applyErr),
            variant: 'destructive',
          });
        }

        // Return to the Debit Note Credits wizard for live summary
        navigate(`/notes/debit/${parentDebitNoteId}/credits`);
      } else if (parentDebitNoteId) {
        // Zero-net credit note: nothing to apply, but still return to wizard
        toast({
          title: 'Credit Note Created (No Net Amount)',
          description: 'This credit note has a zero net amount, so it was not applied automatically.',
        });
        navigate(`/notes/debit/${parentDebitNoteId}/credits`);
      } else {
        navigate('/debit-credit-notes');
      }
    } catch (err: any) {
      toast({ title: 'Failed to post credit note', description: String(err?.message || err) });
    }
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
                <h1 className="text-3xl font-bold">Create Credit Note</h1>
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
                        <Input placeholder="e.g., TransAxis Reinsurance Company (Pvt) Ltd" {...field} />
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
                  name="retroCedant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retro Cedant (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Waica Reinsurance Corporation PLC" {...field} />
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

                {/* Accounting Entity selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Accounting Entity (optional)</FormLabel>
                    <Select onValueChange={(val) => setSelectedEntityId(Number(val))} value={selectedEntityId ? String(selectedEntityId) : undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {entities.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                  name="yourSharePercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Share (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="5.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deductionPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Deductions (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="35.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Calculations Display */}
                <div className="border-t-2 border-t-secondary/20 pt-4 space-y-3 bg-gradient-to-br from-primary/5 to-secondary/5 p-5 rounded-lg shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Your Share Amount:</span>
                    <span className="text-base font-semibold">{form.watch('currency')} {yourShareAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Less Total Deductions:</span>
                    <span className="text-base font-semibold text-destructive">-{form.watch('currency')} {deductionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-secondary/30 pt-3">
                    <span className="font-bold text-primary">Net Due To You:</span>
                    <span className="font-bold text-xl text-secondary">{form.watch('currency')} {netDueToYou.toFixed(2)}</span>
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

                {/* Accounting Accounts selection */}
                <div className="border rounded-md p-4 space-y-3">
                  <FormLabel className="font-semibold">Accounting Accounts</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FormLabel>Accounts Payable (AP)</FormLabel>
                      <Select onValueChange={(val) => setApAccountId(Number(val))} value={apAccountId ? String(apAccountId) : undefined}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AP account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FormLabel>Premium Refund</FormLabel>
                      <Select onValueChange={(val) => setPremiumRefundAccountId(Number(val))} value={premiumRefundAccountId ? String(premiumRefundAccountId) : undefined}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Premium Refund account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FormLabel>Deduction Income</FormLabel>
                      <Select onValueChange={(val) => setDeductionIncomeAccountId(Number(val))} value={deductionIncomeAccountId ? String(deductionIncomeAccountId) : undefined}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Deduction Income account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
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
                Create Credit Note
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </MainLayout>
  );
};

export default CreateCreditNote;
