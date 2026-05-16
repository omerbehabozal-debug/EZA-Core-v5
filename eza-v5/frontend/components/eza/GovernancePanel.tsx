'use client';

import { cn } from '@/lib/utils';

export interface GovernancePanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export default function GovernancePanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  noPadding,
}: GovernancePanelProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-eza-border bg-eza-surface shadow-eza-sm overflow-hidden',
        className
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-col gap-2 border-b border-eza-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold text-eza-text">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-eza-text-secondary">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={cn(!noPadding && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
