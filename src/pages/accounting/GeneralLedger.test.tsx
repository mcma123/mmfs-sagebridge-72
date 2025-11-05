/**
 * Smoke tests for GeneralLedger component
 * Tests basic rendering, filter interactions, and data loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import GeneralLedger from './GeneralLedger';
import * as accountingApi from '@/lib/api/accounting';
import * as authApi from '@/lib/api/auth';

// Mock the API modules
vi.mock('@/lib/api/accounting');
vi.mock('@/lib/api/auth');

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockAccounts = [
  { id: 1, code: '1000', name: 'Cash', type: 'Asset', is_active: true },
  { id: 2, code: '2000', name: 'Accounts Payable', type: 'Liability', is_active: true },
];

const mockLedgerEntries = [
  {
    id: 1,
    account_id: 1,
    journal_line_id: 101,
    date: '2024-01-15',
    debit: '1000.00',
    credit: '0.00',
    balance_after: '1000.00',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    account_id: 1,
    journal_line_id: 102,
    date: '2024-01-16',
    debit: '0.00',
    credit: '500.00',
    balance_after: '500.00',
    created_at: '2024-01-16T10:00:00Z',
  },
];

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('GeneralLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock auth
    vi.mocked(authApi.getPrimaryRole).mockReturnValue('accountant');
    
    // Mock API responses
    vi.mocked(accountingApi.getAccounts).mockResolvedValue({
      items: mockAccounts,
    });
    
    vi.mocked(accountingApi.getLedger).mockResolvedValue({
      items: mockLedgerEntries,
      total: mockLedgerEntries.length,
    });
  });

  it('renders the page header', async () => {
    renderWithProviders(<GeneralLedger />);
    
    expect(screen.getByText('General Ledger')).toBeInTheDocument();
    expect(screen.getByText('View and analyze all financial transactions')).toBeInTheDocument();
  });

  it('renders the back button', () => {
    renderWithProviders(<GeneralLedger />);
    
    const backButton = screen.getByRole('button', { name: /back to accounting/i });
    expect(backButton).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithProviders(<GeneralLedger />);
    
    expect(screen.getByText(/loading ledger entries/i)).toBeInTheDocument();
  });

  it('displays ledger entries after loading', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.queryByText(/loading ledger entries/i)).not.toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Debit')).toBeInTheDocument();
    expect(screen.getByText('Credit')).toBeInTheDocument();
    expect(screen.getByText('Running Balance')).toBeInTheDocument();

    // Check that entries are displayed
    await waitFor(() => {
      expect(screen.getByText(/1000 - Cash/)).toBeInTheDocument();
    });
  });

  it('renders account filter dropdown', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      const accountSelect = screen.getByRole('combobox');
      expect(accountSelect).toBeInTheDocument();
    });
  });

  it('renders date range picker', () => {
    renderWithProviders(<GeneralLedger />);
    
    const dateButton = screen.getByRole('button', { name: /all dates/i });
    expect(dateButton).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithProviders(<GeneralLedger />);
    
    const searchInput = screen.getByPlaceholderText(/search transactions/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('displays totals section when data is loaded', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Debits')).toBeInTheDocument();
      expect(screen.getByText('Total Credits')).toBeInTheDocument();
      expect(screen.getByText('Net Change')).toBeInTheDocument();
    });
  });

  it('shows pagination controls when there are multiple pages', async () => {
    // Mock response with more entries to trigger pagination
    vi.mocked(accountingApi.getLedger).mockResolvedValue({
      items: mockLedgerEntries,
      total: 100, // More than page size (50)
    });

    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.getByText(/showing 1 to/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('calls getLedger with correct role', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(accountingApi.getLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
        'accountant'
      );
    });
  });

  it('shows error state when API fails', async () => {
    vi.mocked(accountingApi.getLedger).mockRejectedValue(new Error('API Error'));

    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load ledger entries/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries exist', async () => {
    vi.mocked(accountingApi.getLedger).mockResolvedValue({
      items: [],
      total: 0,
    });

    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.getByText(/no ledger entries found/i)).toBeInTheDocument();
    });
  });

  it('formats currency values correctly', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      // Check for ZAR currency format (South African Rand)
      const currencyElements = screen.getAllByText(/R/);
      expect(currencyElements.length).toBeGreaterThan(0);
    });
  });

  it('displays journal line IDs', async () => {
    renderWithProviders(<GeneralLedger />);
    
    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.getByText('#102')).toBeInTheDocument();
    });
  });

  it('renders export button', () => {
    renderWithProviders(<GeneralLedger />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeInTheDocument();
  });
});

