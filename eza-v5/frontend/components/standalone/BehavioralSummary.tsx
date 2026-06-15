'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BehavioralSnapshot } from '@/lib/types';
import { buildInteractionSignal, type SignalDetailRow } from '@/lib/eza/interactionSignal';
import type { InsightContext } from '@/lib/eza/behavioralInsights';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface BehavioralSummaryProps {
  data?: BehavioralSnapshot | null;
  ezaScore?: number | null;
  context?: InsightContext;
  align?: 'start' | 'end';
  variant?: 'legacy' | 'saina';
}

function toneDotModifier(emoji: string): string {
  switch (emoji) {
    case '🟠':
      return 'saina-tone-pill__dot--warm';
    case '🔵':
      return 'saina-tone-pill__dot--cool';
    case '🟣':
      return 'saina-tone-pill__dot--violet';
    case '⚪':
      return 'saina-tone-pill__dot--neutral';
    default:
      return '';
  }
}

function SignalDetailPanel({
  rows,
  variant = 'legacy',
}: {
  rows: SignalDetailRow[];
  variant?: 'legacy' | 'saina';
}) {
  if (variant === 'saina') {
    return (
      <ul className="saina-tone-pill-detail">
        {rows.map((row) => (
          <li key={row.label} className="saina-tone-pill-detail__row">
            <span className="saina-tone-pill-detail__label">{row.label}</span>
            <span className="saina-tone-pill-detail__value">{row.value}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={standaloneSkin.signalExpand}>
      <ul className="divide-y divide-standalone-border/40">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 py-1 first:pt-0 last:pb-0">
            <span className="text-[10px] font-normal text-standalone-text-muted">{row.label}</span>
            <span className="text-right text-[10px] font-medium tabular-nums text-standalone-text-secondary">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BehavioralSummary({
  data,
  ezaScore,
  context = 'assistant',
  align = 'start',
  variant = 'legacy',
}: BehavioralSummaryProps) {
  const [open, setOpen] = useState(false);
  const signal = buildInteractionSignal(context, ezaScore, data);

  if (!signal) {
    return null;
  }

  if (variant === 'saina') {
    return (
      <div className={cn('max-w-full', align === 'end' && 'flex flex-col items-end')}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="saina-tone-pill"
          aria-expanded={open}
          aria-label={`${signal.label} — detayları ${open ? 'gizle' : 'göster'}`}
        >
          <span
            className={cn('saina-tone-pill__dot', toneDotModifier(signal.emoji))}
            aria-hidden
          />
          <span className="saina-tone-pill__label">{signal.label}</span>
          <ChevronDown
            className={cn('saina-tone-pill__chevron', open && 'saina-tone-pill__chevron--open')}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="saina-tone-pill-expand">
            <SignalDetailPanel rows={signal.details} variant="saina" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('max-w-full', align === 'end' && 'flex flex-col items-end')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(standaloneSkin.signalPill, align === 'end' && 'text-right')}
        aria-expanded={open}
        aria-label={`${signal.label} — detayları ${open ? 'gizle' : 'göster'}`}
      >
        <span className="shrink-0 text-[10px] leading-none" aria-hidden>
          {signal.emoji}
        </span>
        <span className="truncate font-normal">{signal.label}</span>
        <ChevronDown
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-standalone-text-muted/60 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open ? <SignalDetailPanel rows={signal.details} /> : null}
    </div>
  );
}
