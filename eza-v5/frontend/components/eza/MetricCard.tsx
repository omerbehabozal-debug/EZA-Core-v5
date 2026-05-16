'use client';

import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export type MetricTrend = 'up' | 'down' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: MetricTrend;
  trendLabel?: string;
  className?: string;
}

const trendConfig: Record<
  MetricTrend,
  { icon: typeof TrendingUp; className: string }
> = {
  up: { icon: TrendingUp, className: 'text-emerald-600' },
  down: { icon: TrendingDown, className: 'text-amber-600' },
  neutral: { icon: Minus, className: 'text-eza-text-muted' },
};

export default function MetricCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  className,
}: MetricCardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-eza-border bg-eza-surface p-4 shadow-eza-sm',
        className
      )}
    >
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-eza-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-eza-text">
        {value}
      </p>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-eza-text-secondary">
          {trend && TrendIcon ? (
            <TrendIcon className={cn('h-3.5 w-3.5', trendConfig[trend].className)} aria-hidden />
          ) : null}
          <span>{trendLabel ?? hint}</span>
        </div>
      )}
    </div>
  );
}
