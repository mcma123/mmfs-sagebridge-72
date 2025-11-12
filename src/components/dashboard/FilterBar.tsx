import { useQuery } from '@tanstack/react-query';
import { Calendar, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDashboardFilters, type DateRangePreset } from '@/hooks/useDashboardFilters';

interface Entity {
  id: number;
  name: string;
}

interface EntitiesResponse {
  items: Entity[];
}

export function FilterBar() {
  const {
    filters,
    setDateRangePreset,
    setCustomDateRange,
    setEntityIds,
    clearFilters,
    hasActiveFilters,
  } = useDashboardFilters();

  // Fetch entities for filtering
  const { data: entitiesResponse } = useQuery<EntitiesResponse>({
    queryKey: ['entities'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/accounting/entities', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch entities');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const entities = entitiesResponse?.items || [];

  const handleDateRangeChange = (value: string) => {
    setDateRangePreset(value as DateRangePreset);
  };

  const handleEntityToggle = (entityId: number, checked: boolean) => {
    const currentIds = filters.entityIds || [];
    if (checked) {
      setEntityIds([...currentIds, entityId]);
    } else {
      setEntityIds(currentIds.filter(id => id !== entityId));
    }
  };

  const getDateRangeLabel = () => {
    const presetLabels: Record<DateRangePreset, string> = {
      this_month: 'This Month',
      last_month: 'Last Month',
      this_quarter: 'This Quarter',
      last_quarter: 'Last Quarter',
      this_year: 'This Year',
      custom: 'Custom Range',
    };
    return presetLabels[filters.dateRangePreset];
  };

  const selectedEntityCount = filters.entityIds?.length || 0;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-gray-500" />
        <Select value={filters.dateRangePreset} onValueChange={handleDateRangeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="last_quarter">Last Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Date Range Picker (shown when custom is selected) */}
      {filters.dateRangePreset === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {filters.startDate} - {filters.endDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4 space-y-4">
              <div>
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setCustomDateRange(e.target.value, filters.endDate)
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setCustomDateRange(filters.startDate, e.target.value)
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Entity Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter size={14} />
            Entities
            {selectedEntityCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedEntityCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-2">
            <div className="font-medium text-sm mb-3">Filter by Entity</div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {entities.length === 0 ? (
                <p className="text-sm text-gray-500">No entities available</p>
              ) : (
                entities.map((entity) => (
                  <div key={entity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`entity-${entity.id}`}
                      checked={filters.entityIds?.includes(entity.id) || false}
                      onCheckedChange={(checked) =>
                        handleEntityToggle(entity.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`entity-${entity.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {entity.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
            {selectedEntityCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEntityIds(undefined)}
                className="w-full mt-2"
              >
                Clear Entity Filter
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Indicators */}
      {hasActiveFilters && (
        <>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Active Filters:
            </span>
            {filters.dateRangePreset !== 'this_month' && (
              <Badge variant="secondary" className="gap-1">
                {getDateRangeLabel()}
              </Badge>
            )}
            {selectedEntityCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                {selectedEntityCount} {selectedEntityCount === 1 ? 'Entity' : 'Entities'}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1"
          >
            <X size={14} />
            Clear All
          </Button>
        </>
      )}
    </div>
  );
}
