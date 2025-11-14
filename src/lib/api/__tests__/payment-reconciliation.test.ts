import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOutstandingItems,
  getBankTransactions,
  createBankTransaction,
  importBankStatement,
  suggestMatches,
  applyMatch,
} from '../accounting';

// Mock fetch globally
global.fetch = vi.fn();

describe('Payment Reconciliation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOutstandingItems', () => {
    it('should fetch outstanding receivables successfully', async () => {
      const mockData = {
        items: [
          {
            journal_id: 1,
            journal_reference: 'DN-001',
            journal_description: 'Premium Invoice',
            journal_date: '2024-01-15',
            journal_type: 'debit_note',
            entity_name: 'ABC Insurance',
            outstanding_amount: 5000,
            aging_days: 15,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await getOutstandingItems();

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/outstanding-items',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle errors when fetching outstanding items', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Database error' }),
      });

      await expect(getOutstandingItems()).rejects.toThrow();
    });
  });

  describe('getBankTransactions', () => {
    it('should fetch unallocated bank transactions successfully', async () => {
      const mockData = {
        items: [
          {
            id: 1,
            transaction_date: '2024-01-20',
            reference: 'TRF-12345',
            amount: 5000,
            entity_name: 'ABC Insurance',
            description: 'Premium payment',
            status: 'unallocated',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await getBankTransactions();

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/bank-transactions',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('createBankTransaction', () => {
    it('should create a bank transaction successfully', async () => {
      const mockTransaction = {
        transaction_date: '2024-01-20',
        reference: 'TRF-12345',
        amount: 5000,
        entity_name: 'ABC Insurance',
        description: 'Premium payment',
      };

      const mockResponse = {
        transaction: {
          id: 1,
          ...mockTransaction,
          status: 'unallocated',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createBankTransaction(mockTransaction);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/bank-transactions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockTransaction),
        })
      );
    });

    it('should handle validation errors', async () => {
      const invalidTransaction = {
        transaction_date: '2024-01-20',
        reference: 'TRF-12345',
        amount: -100, // Invalid negative amount
        entity_name: null,
        description: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Amount must be positive' }),
      });

      await expect(createBankTransaction(invalidTransaction)).rejects.toThrow();
    });
  });

  describe('importBankStatement', () => {
    it('should import bank statement CSV successfully', async () => {
      const mockFile = new File(['date,amount,reference\n2024-01-20,5000,TRF-12345'], 'statement.csv', {
        type: 'text/csv',
      });

      const mockResponse = {
        batch_id: 1,
        imported_count: 1,
        skipped_count: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await importBankStatement(mockFile, 'January 2024 Statement');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/bank-transactions/import',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle CSV parsing errors', async () => {
      const mockFile = new File(['invalid csv data'], 'statement.csv', {
        type: 'text/csv',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Invalid CSV format' }),
      });

      await expect(importBankStatement(mockFile)).rejects.toThrow();
    });
  });

  describe('suggestMatches', () => {
    it('should suggest matches for a bank transaction', async () => {
      const mockData = {
        suggestions: [
          {
            journal_id: 1,
            journal_reference: 'DN-001',
            journal_description: 'Premium Invoice',
            journal_date: '2024-01-15',
            journal_type: 'debit_note',
            entity_name: 'ABC Insurance',
            outstanding_amount: 5000,
            match_score: 95,
            confidence: 'high',
            exact_amount_match: true,
            entity_name_match: true,
            reference_match: false,
            date_proximity_match: true,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await suggestMatches(1);

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/reconciliation/suggest-matches',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ bank_transaction_id: 1 }),
        })
      );
    });

    it('should return empty suggestions when no matches found', async () => {
      const mockData = {
        suggestions: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await suggestMatches(999);

      expect(result).toEqual(mockData);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('applyMatch', () => {
    it('should apply match allocations successfully', async () => {
      const mockAllocations = [
        { journal_id: 1, amount: 5000 },
      ];

      const mockResponse = {
        message: 'Allocations applied successfully',
        allocations: mockAllocations,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await applyMatch(1, mockAllocations);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounting/reconciliation/apply-match',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            bank_transaction_id: 1,
            allocations: mockAllocations,
          }),
        })
      );
    });

    it('should handle partial match allocations', async () => {
      const mockAllocations = [
        { journal_id: 1, amount: 3000 },
        { journal_id: 2, amount: 2000 },
      ];

      const mockResponse = {
        message: 'Allocations applied successfully',
        allocations: mockAllocations,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await applyMatch(1, mockAllocations);

      expect(result).toEqual(mockResponse);
      expect(result.allocations).toHaveLength(2);
    });

    it('should handle validation errors for over-allocation', async () => {
      const mockAllocations = [
        { journal_id: 1, amount: 10000 }, // Exceeds payment amount
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Total allocation exceeds payment amount' }),
      });

      await expect(applyMatch(1, mockAllocations)).rejects.toThrow();
    });

    it('should handle database transaction errors', async () => {
      const mockAllocations = [
        { journal_id: 1, amount: 5000 },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Transaction failed' }),
      });

      await expect(applyMatch(1, mockAllocations)).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should complete full reconciliation workflow', async () => {
      // Step 1: Get outstanding items
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              journal_id: 1,
              outstanding_amount: 5000,
              entity_name: 'ABC Insurance',
            },
          ],
        }),
      });

      const outstanding = await getOutstandingItems();
      expect(outstanding.items).toHaveLength(1);

      // Step 2: Create bank transaction
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transaction: {
            id: 1,
            amount: 5000,
            status: 'unallocated',
          },
        }),
      });

      const transaction = await createBankTransaction({
        transaction_date: '2024-01-20',
        reference: 'TRF-12345',
        amount: 5000,
        entity_name: 'ABC Insurance',
        description: null,
      });

      expect(transaction.transaction.id).toBe(1);

      // Step 3: Suggest matches
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              journal_id: 1,
              match_score: 95,
              confidence: 'high',
            },
          ],
        }),
      });

      const suggestions = await suggestMatches(transaction.transaction.id);
      expect(suggestions.suggestions).toHaveLength(1);
      expect(suggestions.suggestions[0].confidence).toBe('high');

      // Step 4: Apply match
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Allocations applied successfully',
          allocations: [{ journal_id: 1, amount: 5000 }],
        }),
      });

      const result = await applyMatch(transaction.transaction.id, [
        { journal_id: 1, amount: 5000 },
      ]);

      expect(result.message).toBe('Allocations applied successfully');
    });
  });
});
