import React from 'react';
import { Progress } from '@/components/ui/progress';

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={className ?? ''}>
      <Progress value={percent} role="progressbar" aria-label={label ?? 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} />
      <span className="sr-only">{percent}%</span>
    </div>
  );
}