'use client';

import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InsightSeverity = 'info' | 'notice' | 'caution';

export interface InsightCardProps {
  title: string;
  body: string;
  severity?: InsightSeverity;
  footer?: React.ReactNode;
  className?: string;
}

const severityStyles: Record<InsightSeverity, string> = {
  info: 'border-eza-border bg-eza-surface',
  notice: 'border-indigo-200 bg-eza-accent-muted',
  caution: 'border-amber-200 bg-amber-50/80',
};

export default function InsightCard({
  title,
  body,
  severity = 'info',
  footer,
  className,
}: InsightCardProps) {
  return (
    <article
      className={cn(
        'rounded-xl border p-4 shadow-eza-sm',
        severityStyles[severity],
        className
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-eza-accent shadow-sm">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-eza-text">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-eza-text-secondary">{body}</p>
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      </div>
    </article>
  );
}
