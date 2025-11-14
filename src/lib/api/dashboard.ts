/**
 * Dashboard API Client
 * Provides type-safe access to dashboard endpoints
 */

const API_BASE_URL = '/api/v1';

/**
 * Get authentication headers for API requests
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Financial Overview Response
 */
export interface FinancialOverview {
  total_cash_flow: number;
  accounts_receivable: number;
  accounts_payable: number;
  bank_balance: number;
  total_cash_flow_change: number;
  accounts_receivable_change: number;
  accounts_payable_change: number;
  bank_balance_change: number;
}

/**
 * Performance Chart Data Point
 */
export interface PerformanceDataPoint {
  month_name: string;
  income: number;
  expenses: number;
}

/**
 * Performance Chart Response
 */
export interface PerformanceChartResponse {
  items: PerformanceDataPoint[];
}

/**
 * Recent Transaction Item
 */
export interface RecentTransaction {
  id: number;
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  type: 'income' | 'expense';
  created_at: string;
}

/**
 * Recent Transactions Response
 */
export interface RecentTransactionsResponse {
  items: RecentTransaction[];
}

/**
 * Marine Insurance KPIs
 */
export interface MarineKPIs {
  premium_receivables: number;
  commission_payable: number;
  unreconciled_count: number;
  unreconciled_amount: number;
  premium_income_mtd: number;
  claims_ratio: number;
  reinsurance_utilization: number;
  premium_receivables_change: number;
  commission_payable_change: number;
  premium_income_change: number;
  claims_ratio_change: number;
  reinsurance_utilization_change: number;
}

/**
 * Upcoming Payment Item
 */
export interface UpcomingPayment {
  id: number;
  due_date: string;
  entity_name: string | null;
  description: string;
  amount: number;
  status: 'draft' | 'reviewed';
  payment_status: 'overdue' | 'due_today' | 'upcoming';
}

/**
 * Upcoming Payments Response
 */
export interface UpcomingPaymentsResponse {
  items: UpcomingPayment[];
}

/**
 * Recent Reconciliation Item
 */
export interface RecentReconciliation {
  id: number;
  transaction_date: string;
  reference: string | null;
  amount: number;
  status: 'matched' | 'partially_matched';
  allocation_count: number;
}

/**
 * Reconciliation Summary Response
 */
export interface ReconciliationSummary {
  unallocated_count: number;
  unallocated_amount: number;
  recent_reconciliations: RecentReconciliation[];
}

/**
 * Dashboard Filter Options
 */
export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  entityIds?: number[];
}

/**
 * Build query string from filters
 */
const buildFilterQuery = (filters?: DashboardFilters): string => {
  if (!filters) return '';

  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.entityIds && filters.entityIds.length > 0) {
    params.append('entityIds', filters.entityIds.join(','));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

/**
 * Dashboard API methods
 */
export const dashboardApi = {
  /**
   * Fetch financial overview metrics
   */
  getOverview: async (filters?: DashboardFilters): Promise<FinancialOverview> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview${buildFilterQuery(filters)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch financial overview: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch performance chart data (monthly income vs expenses)
   * @param months - Number of months to retrieve (default: 7)
   * @param filters - Optional date/entity filters
   */
  getPerformance: async (months: number = 7, filters?: DashboardFilters): Promise<PerformanceChartResponse> => {
    const baseQuery = `months=${months}`;
    const filterQuery = buildFilterQuery(filters).replace('?', '&');
    const response = await fetch(`${API_BASE_URL}/dashboard/performance?${baseQuery}${filterQuery}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch performance data: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch recent transactions (last 10 posted journals)
   */
  getRecentTransactions: async (filters?: DashboardFilters): Promise<RecentTransactionsResponse> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/recent-transactions${buildFilterQuery(filters)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch recent transactions: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch marine insurance KPIs
   */
  getMarineKPIs: async (filters?: DashboardFilters): Promise<MarineKPIs> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/marine-kpis${buildFilterQuery(filters)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch marine KPIs: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch upcoming payment obligations
   */
  getUpcomingPayments: async (filters?: DashboardFilters): Promise<UpcomingPaymentsResponse> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/upcoming-payments${buildFilterQuery(filters)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch upcoming payments: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch payment reconciliation summary
   * Returns count and total of unallocated payments plus recent reconciliations
   */
  getReconciliationSummary: async (): Promise<ReconciliationSummary> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/reconciliation-summary`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch reconciliation summary: ${response.statusText}`);
    }
    return response.json();
  },
};
