import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAccounts, getTrialBalance, deleteAccount } from '@/lib/api/accounting';
import type { AccountDTO, TrialBalanceDTO } from '@/lib/api/accounting';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Search,
  Plus,
  FileUp,
  FileDown,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  CheckSquare
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const accounts = [
  // Assets - Client Premium Receivables
  {
    id: 1,
    name: 'Client Premium Receivables',
    number: '11001',
    category: 'Assets',
    subcategory: 'Current Assets',
    description: 'Premiums owed by clients for marine insurance policies',
    balance: 'R245,500.00',
    active: true,
    isSystem: true
  },
  {
    id: 2,
    name: 'Reinsurance Recoverable',
    number: '11002',
    category: 'Assets',
    subcategory: 'Current Assets',
    description: 'Claims recoverable from reinsurers',
    balance: 'R185,750.00',
    active: true,
    isSystem: true
  },
  {
    id: 3,
    name: 'Bank - ZAR Current Account',
    number: '11003',
    category: 'Assets',
    subcategory: 'Current Assets',
    description: 'Main operating account in South African Rand',
    balance: 'R532,100.00',
    active: true,
    isSystem: true
  },
  {
    id: 4,
    name: 'Bank - USD Account',
    number: '11004',
    category: 'Assets',
    subcategory: 'Current Assets',
    description: 'US Dollar denominated bank account',
    balance: '$45,800.00',
    active: true,
    isSystem: true
  },
  {
    id: 5,
    name: 'Bank - EUR Account',
    number: '11005',
    category: 'Assets',
    subcategory: 'Current Assets',
    description: 'Euro denominated bank account',
    balance: '€28,500.00',
    active: true,
    isSystem: true
  },
  // Liabilities - Commission & Premium Payables
  {
    id: 6,
    name: 'CDANT Commission Payable',
    number: '21001',
    category: 'Liabilities',
    subcategory: 'Current Liabilities',
    description: 'Commissions owed to Commercial Direct Agents',
    balance: 'R122,300.00',
    active: true,
    isSystem: true
  },
  {
    id: 7,
    name: 'Reinsurance Premium Payable',
    number: '21002',
    category: 'Liabilities',
    subcategory: 'Current Liabilities',
    description: 'Premiums payable to reinsurers',
    balance: 'R298,500.00',
    active: true,
    isSystem: true
  },
  {
    id: 8,
    name: 'Unearned Premium Reserve',
    number: '21003',
    category: 'Liabilities',
    subcategory: 'Current Liabilities',
    description: 'Premium received for unexpired policy periods',
    balance: 'R675,000.00',
    active: true,
    isSystem: true
  },
  {
    id: 9,
    name: 'Claims Reserve',
    number: '21004',
    category: 'Liabilities',
    subcategory: 'Current Liabilities',
    description: 'Reserve for reported but unpaid claims',
    balance: 'R425,000.00',
    active: true,
    isSystem: true
  },
  // Equity
  {
    id: 10,
    name: 'Share Capital',
    number: '31001',
    category: 'Equity',
    subcategory: 'Capital',
    description: 'Owner\'s investment in MMFS',
    balance: 'R500,000.00',
    active: true,
    isSystem: true
  },
  {
    id: 11,
    name: 'Retained Earnings',
    number: '31002',
    category: 'Equity',
    subcategory: 'Capital',
    description: 'Accumulated profits from marine insurance operations',
    balance: 'R343,200.00',
    active: true,
    isSystem: true
  },
  // Revenue - Premium Income by Product
  {
    id: 12,
    name: 'Premium Income - Marine Cargo',
    number: '41001',
    category: 'Income',
    subcategory: 'Premium Income',
    description: 'Premium earned from marine cargo insurance',
    balance: 'R824,500.00',
    active: true,
    isSystem: false
  },
  {
    id: 13,
    name: 'Premium Income - Marine Hull',
    number: '41002',
    category: 'Income',
    subcategory: 'Premium Income',
    description: 'Premium earned from marine hull insurance',
    balance: 'R654,200.00',
    active: true,
    isSystem: false
  },
  {
    id: 14,
    name: 'Premium Income - Freight',
    number: '41003',
    category: 'Income',
    subcategory: 'Premium Income',
    description: 'Premium earned from freight insurance',
    balance: 'R432,750.00',
    active: true,
    isSystem: false
  },
  {
    id: 15,
    name: 'Reinsurance Commission Received',
    number: '41004',
    category: 'Income',
    subcategory: 'Commission Income',
    description: 'Commission earned from reinsurers on ceded premiums',
    balance: 'R89,250.00',
    active: true,
    isSystem: false
  },
  // Expenses - Reinsurance & Commissions
  {
    id: 16,
    name: 'Reinsurance Premium Ceded',
    number: '51001',
    category: 'Expenses',
    subcategory: 'Reinsurance Costs',
    description: 'Premiums paid to reinsurers for risk sharing',
    balance: 'R568,300.00',
    active: true,
    isSystem: false
  },
  {
    id: 17,
    name: 'Commission Expense - CDANTs',
    number: '51002',
    category: 'Expenses',
    subcategory: 'Commission Costs',
    description: 'Commissions paid to Commercial Direct Agents',
    balance: 'R212,400.00',
    active: true,
    isSystem: false
  },
  {
    id: 18,
    name: 'Claims Expense',
    number: '51003',
    category: 'Expenses',
    subcategory: 'Claims Costs',
    description: 'Marine insurance claims paid to policyholders',
    balance: 'R385,600.00',
    active: true,
    isSystem: false
  },
  {
    id: 19,
    name: 'Operating Expenses',
    number: '51004',
    category: 'Expenses',
    subcategory: 'Operating Costs',
    description: 'General administrative and operating expenses',
    balance: 'R143,450.00',
    active: true,
    isSystem: false
  },
  {
    id: 20,
    name: 'Foreign Exchange Gains/Losses',
    number: '51005',
    category: 'Expenses',
    subcategory: 'FX Adjustments',
    description: 'Realized and unrealized foreign exchange differences',
    balance: 'R15,200.00',
    active: true,
    isSystem: true
  },
];

// Helper function to determine category from account type
const getCategoryFromType = (type: string): string => {
  const typeLower = type.toLowerCase();

  if (typeLower.includes('asset')) return 'Assets';
  if (typeLower.includes('liabilit')) return 'Liabilities';
  if (typeLower.includes('equity') || typeLower.includes('capital') || typeLower.includes('earnings')) return 'Equity';
  if (typeLower.includes('income') || typeLower.includes('revenue')) return 'Income';
  if (typeLower.includes('expense') || typeLower.includes('cost')) return 'Expenses';

  // Default fallback
  return 'Assets';
};

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [accountToDelete, setAccountToDelete] = useState<any | null>(null);

  // Fetch accounts from API
  const { data: accountsData, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts('accountant'),
  });

  // Fetch trial balance data
  const { data: trialBalanceData } = useQuery({
    queryKey: ['trial-balance'],
    queryFn: () => getTrialBalance('accountant'),
  });

  // Create balance lookup map
  const balanceMap = new Map<number, number>();
  (trialBalanceData?.items || []).forEach((item: TrialBalanceDTO) => {
    balanceMap.set(item.account_id, item.balance);
  });

  // Helper function to format currency
  const formatCurrency = (amount: number, currency: string = 'ZAR'): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Transform API data to match component structure
  const accounts = (accountsData?.items || []).map((account: AccountDTO) => ({
    id: account.id,
    name: account.name,
    number: account.code,
    category: getCategoryFromType(account.type),
    subcategory: account.type,
    description: '', // API doesn't return description yet
    balance: formatCurrency(balanceMap.get(account.id) || 0, 'ZAR'),
    active: account.is_active ?? true,
    isSystem: false,
  }));

  const filteredAccounts = accounts
    .filter(account =>
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.number.includes(searchTerm) ||
      account.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(account =>
      selectedCategory ? account.category === selectedCategory : true
    );

  const groupedAccounts: Record<string, typeof accounts> = {};
  filteredAccounts.forEach(account => {
    if (!groupedAccounts[account.category]) {
      groupedAccounts[account.category] = [];
    }
    groupedAccounts[account.category].push(account);
  });
  
  const toggleSelectRow = (id: number) => {
    setSelectedRows(prev =>
      prev.includes(id)
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    );
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      await deleteAccount(accountToDelete.id, 'accountant');
      toast({
        title: 'Account deleted',
        description: `${accountToDelete.name} has been deleted.`,
      });
      refetch();
      setAccountToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Failed to delete account',
        description: error.message || 'An error occurred while deleting the account.',
        variant: 'destructive',
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredAccounts.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredAccounts.map(account => account.id));
    }
  };

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sage-blue hover:text-sage-blue/90 hover:bg-sage-blue/10 flex items-center gap-2 text-sm font-medium"
            onClick={() => navigate('/accounting')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounting
          </Button>
        </div>
        
        <div className="bg-sage-blue rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-2">Chart of Accounts</h1>
          <p className="text-white/80">Marine insurance account structure for MMFS operations</p>
        </div>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">List of Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-blue"></div>
                <span className="ml-3 text-muted-foreground">Loading accounts...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">Failed to load accounts. Please try again.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Main Content */}
            {!isLoading && !error && (
            <>
            <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Assets">Assets</SelectItem>
                    <SelectItem value="Liabilities">Liabilities</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expenses">Expenses</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" className="shrink-0">
                  <Filter size={16} />
                </Button>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="gap-1">
                  <FileDown size={16} />
                  Export
                </Button>
                <Button variant="outline" className="gap-1">
                  <FileUp size={16} />
                  Import
                </Button>
                <Button className="gap-1" onClick={() => navigate('/accounting/add-account')}>
                  <Plus size={16} />
                  Add Account
                </Button>
              </div>
            </div>

            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-2 bg-sage-lightGray rounded-md">
                <CheckSquare size={16} className="text-sage-blue" />
                <span className="text-sm font-medium">{selectedRows.length} accounts selected</span>
                <div className="flex-1"></div>
                <Button variant="ghost" size="sm" className="text-sage-blue hover:bg-sage-blue/10">
                  Export Selected
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                  Delete Selected
                </Button>
              </div>
            )}
            
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage-lightGray">
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={selectedRows.length === filteredAccounts.length && filteredAccounts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[100px]">Account #</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px]">Category</TableHead>
                    <TableHead className="text-right w-[150px]">Balance</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                
                {Object.keys(groupedAccounts).map(category => (
                  <React.Fragment key={category}>
                    <TableBody>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableCell colSpan={8} className="font-medium">
                          {category} ({groupedAccounts[category].length})
                        </TableCell>
                      </TableRow>
                      
                      {groupedAccounts[category].map(account => (
                        <TableRow 
                          key={account.id}
                          className={selectedRows.includes(account.id) ? 'bg-blue-50' : ''}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedRows.includes(account.id)}
                              onCheckedChange={() => toggleSelectRow(account.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono">{account.number}</TableCell>
                          <TableCell>
                            <div className="font-medium hover:text-sage-blue cursor-pointer" onClick={() => navigate(`/accounting/account/${account.id}`)}>
                              {account.name}
                            </div>
                            <div className="text-xs text-muted-foreground">{account.subcategory}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{account.description}</TableCell>
                          <TableCell>{account.category}</TableCell>
                          <TableCell className="text-right font-mono">{account.balance}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${account.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                              {account.active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/accounting/account/${account.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/accounting/account/${account.id}/edit`)}
                                  disabled={account.isSystem}
                                >
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setAccountToDelete(account)}
                                  disabled={account.isSystem}
                                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </React.Fragment>
                ))}
              </Table>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{accountToDelete?.name}"? This action cannot be undone.
                {accountToDelete?.isSystem && (
                  <span className="block mt-2 text-red-600 font-medium">
                    This is a system account and cannot be deleted.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </MainLayout>
  );
};

export default ChartOfAccounts;
