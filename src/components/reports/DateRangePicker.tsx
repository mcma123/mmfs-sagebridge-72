/**
 * Unified date range selection component for reports
 */

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range',
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    onChange?.(range);
    // Close popover if both dates are selected
    if (range?.from && range?.to) {
      setIsOpen(false);
    }
  };

  const formatDateRange = (range?: DateRange) => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, 'MMM dd, yyyy');
    return `${format(range.from, 'MMM dd, yyyy')} - ${format(range.to, 'MMM dd, yyyy')}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface SingleDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function SingleDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'MMM dd, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={handleSelect} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
