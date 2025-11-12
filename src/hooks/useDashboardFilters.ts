import { useState, useEffect } from 'react';
import type { DashboardFilters } from '@/lib/api/dashboard';

export type DateRangePreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';

interface DashboardFilterState extends DashboardFilters {
  dateRangePreset: DateRangePreset;
}

const STORAGE_KEY = 'dashboard-filters';

/**
 * Get date range based on preset
 */
const getDateRangeForPreset = (preset: DateRangePreset): { startDate: string; endDate: string } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        startDate: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };

    case 'last_month': {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastDayOfLastMonth = new Date(currentYear, currentMonth, 0).getDate();
      return {
        startDate: new Date(lastMonthYear, lastMonth, 1).toISOString().split('T')[0],
        endDate: new Date(lastMonthYear, lastMonth, lastDayOfLastMonth).toISOString().split('T')[0],
      };
    }

    case 'this_quarter': {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      return {
        startDate: new Date(currentYear, quarterStartMonth, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };
    }

    case 'last_quarter': {
      const lastQuarterStartMonth = Math.floor(currentMonth / 3) * 3 - 3;
      const lastQuarterYear = lastQuarterStartMonth < 0 ? currentYear - 1 : currentYear;
      const adjustedStartMonth = lastQuarterStartMonth < 0 ? lastQuarterStartMonth + 12 : lastQuarterStartMonth;
      const lastQuarterEndMonth = adjustedStartMonth + 2;
      const lastDayOfQuarter = new Date(lastQuarterYear, lastQuarterEndMonth + 1, 0).getDate();
      return {
        startDate: new Date(lastQuarterYear, adjustedStartMonth, 1).toISOString().split('T')[0],
        endDate: new Date(lastQuarterYear, lastQuarterEndMonth, lastDayOfQuarter).toISOString().split('T')[0],
      };
    }

    case 'this_year':
      return {
        startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };

    case 'custom':
    default:
      return {
        startDate: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };
  }
};

/**
 * Custom hook for managing dashboard filter state
 */
export function useDashboardFilters() {
  const [filters, setFilters] = useState<DashboardFilterState>(() => {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          dateRangePreset: parsed.dateRangePreset || 'this_month',
        };
      }
    } catch (e) {
      console.error('Failed to load dashboard filters from localStorage:', e);
    }

    // Default to this month
    const { startDate, endDate } = getDateRangeForPreset('this_month');
    return {
      startDate,
      endDate,
      entityIds: undefined,
      dateRangePreset: 'this_month',
    };
  });

  // Save to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save dashboard filters to localStorage:', e);
    }
  }, [filters]);

  /**
   * Set date range preset
   */
  const setDateRangePreset = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setFilters((prev) => ({ ...prev, dateRangePreset: 'custom' }));
    } else {
      const { startDate, endDate } = getDateRangeForPreset(preset);
      setFilters({
        ...filters,
        startDate,
        endDate,
        dateRangePreset: preset,
      });
    }
  };

  /**
   * Set custom date range
   */
  const setCustomDateRange = (startDate: string, endDate: string) => {
    setFilters({
      ...filters,
      startDate,
      endDate,
      dateRangePreset: 'custom',
    });
  };

  /**
   * Set entity filter
   */
  const setEntityIds = (entityIds: number[] | undefined) => {
    setFilters({ ...filters, entityIds });
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    const { startDate, endDate } = getDateRangeForPreset('this_month');
    setFilters({
      startDate,
      endDate,
      entityIds: undefined,
      dateRangePreset: 'this_month',
    });
  };

  /**
   * Check if any filters are active (non-default)
   */
  const hasActiveFilters = filters.dateRangePreset !== 'this_month' || (filters.entityIds && filters.entityIds.length > 0);

  /**
   * Get API-compatible filters (without dateRangePreset)
   */
  const getApiFilters = (): DashboardFilters => {
    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
      entityIds: filters.entityIds,
    };
  };

  return {
    filters,
    setDateRangePreset,
    setCustomDateRange,
    setEntityIds,
    clearFilters,
    hasActiveFilters,
    getApiFilters,
  };
}
