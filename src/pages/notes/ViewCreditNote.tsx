import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mmfsLogo from '@/assets/mmfs-logo.jpg';
import { getJournal, type JournalDTO } from '@/lib/api/accounting';
import { format } from 'date-fns';

const ViewCreditNote = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { toast } = useToast();
    const [journal, setJournal] = useState<JournalDTO | null>(null);
    const [noteData, setNoteData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        loadJournal(parseInt(id));
    }, [id]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('print') === 'true' && !loading && noteData) {
            // Small delay to ensure rendering is complete
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [loading, noteData]);

    const loadJournal = async (journalId: number) => {
        try {
            setLoading(true);
            const data = await getJournal(journalId);
            setJournal(data.journal);

            // Find the AP line to get the metadata
            const apLine = data.lines.find(l => {
                try {
                    const memo = JSON.parse(l.memo || '{}');
                    return memo.kind === 'AP';
                } catch {
                    return false;
                }
            });

            if (apLine && apLine.memo) {
                try {
                    const memo = JSON.parse(apLine.memo);
                    if (memo.form) {
                        setNoteData({ ...memo.form, _netAmount: apLine.credit });
                    } else {
                        // Legacy fallback
                        setNoteData({
                            ...memo,
                            issuedTo: data.journal.description?.match(/Entity\s+([^;]+)/)?.[1]?.trim() || '',
                            notes: data.journal.description || '',
                            _netAmount: apLine.credit, // Store the actual line amount
                        });
                    }
                } catch (e) {
                    console.error('Failed to parse memo', e);
                }
            }
        } catch (err) {
            console.error('Failed to load journal', err);
            toast({ title: 'Error', description: 'Failed to load credit note details', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </MainLayout>
        );
    }

    if (!noteData) {
        return (
            <MainLayout>
                <div className="p-8 text-center text-red-500">
                    Failed to load note data.
                </div>
            </MainLayout>
        );
    }

    // Calculations
    const grossPremium = parseFloat(noteData.grossPremium || '0');
    const yourSharePercentage = parseFloat(noteData.yourSharePercentage || '0');
    const deductionPercentage = parseFloat(noteData.deductionPercentage || '0');
    const currency = noteData.currency || 'USD';

    const yourShareAmount = (grossPremium * yourSharePercentage) / 100;
    const deductionAmount = (yourShareAmount * deductionPercentage) / 100;

    // Use the stored line amount if available (legacy fallback), otherwise calculate
    const netDueToYou = noteData._netAmount !== undefined ? noteData._netAmount : (yourShareAmount - deductionAmount);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            return format(new Date(dateStr), 'do MMMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <MainLayout>
            <div className="mb-4 flex justify-between items-center print:hidden">
                <Button variant="outline" onClick={() => navigate('/debit-credit-notes')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg print:shadow-none print:p-0 text-black"
                style={{ minHeight: '297mm' }} // A4 height
            >
                {/* Header Title */}
                <div className="flex justify-center mb-8">
                    <div className="border-2 border-black px-8 py-2 text-2xl font-bold uppercase tracking-wider">
                        Credit Note
                    </div>
                </div>

                {/* Logo and Address */}
                <div className="flex justify-between items-start mb-12">
                    <div className="w-1/2">
                        <img src={mmfsLogo} alt="MMFS Logo" className="h-20 w-auto object-contain mb-4" />
                        <div className="text-sm font-medium">
                            <p>MMFS Intermediaries Pty Ltd</p>
                            <p>Atrium on 5th, 9th Floor, 5th Street,</p>
                            <p>Sandton, Johannesburg, South Africa.</p>
                        </div>
                    </div>
                    <div className="w-1/2 text-right text-sm">
                        <p className="font-bold mb-1">Issued To:</p>
                        <div className="whitespace-pre-line">
                            {noteData.issuedToAddress || noteData.issuedTo}
                        </div>
                    </div>
                </div>

                {/* Note Details */}
                <div className="flex justify-between items-start mb-8">
                    <div className="w-2/3 space-y-2 text-sm">
                        <div className="grid grid-cols-[100px_1fr]">
                            <span className="font-bold">Insured:</span>
                            <span className="uppercase">{noteData.insured}</span>
                        </div>
                        {noteData.retroCedant && (
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold">Retro Cedant:</span>
                                <span className="uppercase">{noteData.retroCedant}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-[100px_1fr]">
                            <span className="font-bold">Cover:</span>
                            <span className="uppercase">{noteData.coverType}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr]">
                            <span className="font-bold">REF.:</span>
                            <span className="uppercase">{noteData.policyRef}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr]">
                            <span className="font-bold">Period of Cover:</span>
                            <span>{formatDate(noteData.periodFrom)} to {formatDate(noteData.periodTo)}</span>
                        </div>
                    </div>
                    <div className="w-1/3 text-right">
                        <p className="font-bold text-sm">Credit Note Number: {journal?.reference}</p>
                    </div>
                </div>

                {/* Premium Table */}
                <div className="mb-8 border-2 border-black">
                    <div className="grid grid-cols-[1fr_150px] border-b border-black font-bold text-sm">
                        <div className="p-2 border-r border-black">Premium Details</div>
                        <div className="p-2 text-right">Amount - {currency}</div>
                    </div>

                    <div className="grid grid-cols-[1fr_150px] border-b border-black text-sm">
                        <div className="p-2 border-r border-black">100% Gross Premium</div>
                        <div className="p-2 text-right">{formatMoney(grossPremium)}</div>
                    </div>

                    <div className="grid grid-cols-[1fr_100px_150px] border-b border-black text-sm">
                        <div className="p-2 border-r border-black">Your Share</div>
                        <div className="p-2 border-r border-black text-center">{noteData.yourSharePercentage}%</div>
                        <div className="p-2 text-right">{formatMoney(yourShareAmount)}</div>
                    </div>

                    <div className="grid grid-cols-[1fr_100px_150px] border-b border-black text-sm">
                        <div className="p-2 border-r border-black">Less Total Deductions</div>
                        <div className="p-2 border-r border-black text-center">{noteData.deductionPercentage}%</div>
                        <div className="p-2 text-right">{formatMoney(deductionAmount)}</div>
                    </div>

                    <div className="grid grid-cols-[1fr_150px] font-bold text-sm bg-gray-50 print:bg-transparent">
                        <div className="p-2 border-r border-black">Net Due To You</div>
                        <div className="p-2 text-right">{formatMoney(netDueToYou)}</div>
                    </div>
                </div>

                <div className="mb-8 text-sm font-bold">
                    Premium Payment Terms - {noteData.paymentTerms}
                </div>

                {/* Bank Details Table - Same as Debit Note */}
                <div className="mb-12 border-2 border-black text-sm">
                    <div className="text-center font-bold border-b border-black p-1 bg-gray-100 print:bg-transparent">
                        Bank Details
                    </div>

                    <div className="grid grid-cols-[150px_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Account Name</div>
                        <div className="p-1">MMFS Intermediaries Pty Ltd</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Bank</div>
                        <div className="p-1">First National Bank (FNB), South Africa</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Currency</div>
                        <div className="p-1 border-r border-black">South African Rand - ZAR</div>
                        <div className="p-1">United States Dollar - USD</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Account Type</div>
                        <div className="p-1 border-r border-black">Gold Business Account</div>
                        <div className="p-1">CFC Business Account</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Branch</div>
                        <div className="p-1 border-r border-black">The Reds</div>
                        <div className="p-1">The Reds</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Branch Code</div>
                        <div className="p-1 border-r border-black">250130</div>
                        <div className="p-1">250130</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr] border-b border-black">
                        <div className="p-1 border-r border-black font-medium">Swift Code</div>
                        <div className="p-1 border-r border-black">FIRNZAJJ</div>
                        <div className="p-1">FIRNZAJJ</div>
                    </div>

                    <div className="grid grid-cols-[150px_1fr_1fr]">
                        <div className="p-1 border-r border-black font-medium">Account Number</div>
                        <div className="p-1 border-r border-black">63075317925</div>
                        <div className="p-1">63131662842</div>
                    </div>
                </div>

                {/* Footer / Signature */}
                <div className="flex items-end justify-between mt-12 pt-8">
                    <div className="text-sm">
                        <span className="font-bold">Prepared By : </span>
                        <span>{noteData.preparedBy}</span>
                    </div>

                    <div className="flex items-end gap-2">
                        <span className="font-bold text-sm mb-1">Signature...........</span>
                        <div className="w-48 border-b border-black"></div>
                    </div>

                    {/* Stamp Placeholder */}
                    <div className="w-32 h-32 border-2 border-blue-200 rounded-full flex items-center justify-center text-blue-200 rotate-[-15deg]">
                        <div className="text-center text-xs">
                            <p className="font-bold">MMFS</p>
                            <p>Johannesburg</p>
                            <p>South Africa</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </MainLayout>
    );
};

export default ViewCreditNote;
