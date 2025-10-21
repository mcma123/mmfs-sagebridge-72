import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, DollarSign, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Sample data
const outstandingItems = [
  { 
    id: 1, 
    type: 'Premium', 
    entity: 'Oceanic Shipping Ltd',
    policyRef: 'MC-2024-0123',
    amount: 45000,
    currency: 'USD',
    dueDate: '2024-01-25',
    aging: '15 days'
  },
  { 
    id: 2, 
    type: 'Commission', 
    entity: 'Marine Brokers PTY',
    policyRef: 'MH-2024-0456',
    amount: 22500,
    currency: 'ZAR',
    dueDate: '2024-01-20',
    aging: '20 days'
  },
  { 
    id: 3, 
    type: 'Reinsurance', 
    entity: 'Global Reinsurance Corp',
    policyRef: 'MC-2024-0189',
    amount: 35000,
    currency: 'USD',
    dueDate: '2024-01-30',
    aging: '10 days'
  },
];

const unallocatedPayments = [
  { 
    id: 1, 
    date: '2024-01-18',
    reference: 'TRF-089234',
    amount: 45000,
    currency: 'USD',
    source: 'Bank Transfer'
  },
  { 
    id: 2, 
    date: '2024-01-19',
    reference: 'DEP-012456',
    amount: 22500,
    currency: 'ZAR',
    source: 'Direct Deposit'
  },
];

const PaymentReconciliation = () => {
  const [selectedOutstanding, setSelectedOutstanding] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
  const [searchOutstanding, setSearchOutstanding] = useState('');
  const [searchPayment, setSearchPayment] = useState('');

  const handleMatch = () => {
    if (selectedOutstanding && selectedPayment) {
      // Handle matching logic
      console.log('Matching:', selectedOutstanding, selectedPayment);
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
          <div>
            <h1 className="text-2xl font-semibold">Payment Reconciliation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Match payments with outstanding items
            </p>
          </div>
          <Button onClick={handleMatch} disabled={!selectedOutstanding || !selectedPayment}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Match Selected
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outstanding Items Panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                  Outstanding Items
                </CardTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {outstandingItems.length} items
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by entity or reference..."
                  value={searchOutstanding}
                  onChange={(e) => setSearchOutstanding(e.target.value)}
                  className="flex-1"
                />
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="reinsurance">Reinsurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {outstandingItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedOutstanding(item.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedOutstanding === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.entity}</p>
                      <p className="text-xs text-muted-foreground">{item.policyRef}</p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {item.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-amber-600">
                      {item.currency} {item.amount.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">Due: {item.dueDate}</span>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                      {item.aging} overdue
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Unallocated Payments Panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Unallocated Payments
                </CardTitle>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {unallocatedPayments.length} payments
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference or amount..."
                  value={searchPayment}
                  onChange={(e) => setSearchPayment(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {unallocatedPayments.map(payment => (
                <div
                  key={payment.id}
                  onClick={() => setSelectedPayment(payment.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPayment === payment.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{payment.reference}</p>
                      <p className="text-xs text-muted-foreground">{payment.source}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{payment.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-600">
                      {payment.currency} {payment.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Auto-match suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Match Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Select items from both panels to see match suggestions</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default PaymentReconciliation;
