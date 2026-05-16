'use client';

import { cn } from '@/lib/utils';

export type EventBadgeVariant = 'mode' | 'entity' | 'type' | 'neutral';

export interface EventBadgeProps {
  children: React.ReactNode;
  variant?: EventBadgeVariant;
  className?: string;
}

const variantClasses: Record<EventBadgeVariant, string> = {
  mode: 'bg-indigo-50 text-indigo-800 border-indigo-100',
  entity: 'bg-slate-100 text-slate-700 border-slate-200',
  type: 'bg-violet-50 text-violet-800 border-violet-100',
  neutral: 'bg-eza-surface-muted text-eza-text-secondary border-eza-border',
};

export default function EventBadge({
  children,
  variant = 'neutral',
  className,
}: EventBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
