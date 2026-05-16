'use client';

import { useState } from 'react';
import { Check, ChevronDown, Minus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BehavioralSnapshot } from '@/lib/types';
import {
  buildInteractionInsight,
  buildScoreOnlyInsight,
  getScoreRiskLabel,
  type InsightContext,
  type InsightTone,
  type InteractionInsightView,
} from '@/lib/eza/behavioralInsights';
import { scoreBadgeStyles } from '@/lib/eza/standaloneSkin';

interface BehavioralSummaryProps {
  data?: BehavioralSnapshot | null;
  ezaScore?: number | null;
  context?: InsightContext;
  align?: 'start' | 'end';
}

function BulletIcon({ tone }: { tone: InsightTone }) {
  if (tone === 'positive') {
    return <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={2.5} aria-hidden />;
  }
  if (tone === 'caution') {
    return <ShieldAlert className="h-2.5 w-2.5 text-amber-600" strokeWidth={2.5} aria-hidden />;
  }
  return <Minus className="h-2.5 w-2.5 text-standalone-text-muted" strokeWidth={2.5} aria-hidden />;
}

function InsightSummaryLabel({
  score,
  pending,
  hint,
}: {
  score: number | null;
  pending?: boolean;
  hint: string;
}) {
  const display = score !== null ? Math.max(0, Math.min(100, Math.round(score))) : null;
  const scoreColor = display !== null ? scoreBadgeStyles(display).color : undefined;

  return (
    <span className="truncate text-[11px] font-normal text-standalone-text-muted">
      EZA{' '}
      {display !== null ? (
        <span className="tabular-nums font-medium" style={{ color: scoreColor }}>
          {display}
        </span>
      ) : pending ? (
        <span className="tabular-nums font-medium text-standalone-text-muted animate-pulse">…</span>
      ) : (
        <span className="tabular-nums text-standalone-text-muted">—</span>
      )}
      {hint ? (
        <>
          {' '}
          <span className="font-normal text-standalone-text-muted">·</span>{' '}
          <span className="font-normal">{hint}</span>
        </>
      ) : null}
    </span>
  );
}

function ScoreDetailPanel({ insight }: { insight: InteractionInsightView }) {
  const display =
    insight.score !== null ? Math.max(0, Math.min(100, Math.round(insight.score))) : null;
  const scoreColor = display !== null ? scoreBadgeStyles(display).color : undefined;

  return (
    <div className="mt-1.5 rounded-md border border-standalone-border/60 bg-white/70 px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {display !== null ? (
        <div className="mb-1.5 flex items-baseline gap-1.5 border-b border-standalone-border/50 pb-1.5">
          <span className="text-sm font-semibold tabular-nums leading-none" style={{ color: scoreColor }}>
            {display}
          </span>
          <span className="text-[11px] font-normal text-standalone-text-muted">{getScoreRiskLabel(display)}</span>
        </div>
      ) : null}
      <ul className="space-y-0.5">
        {insight.bullets.map((bullet) => (
          <li key={bullet.text} className="flex items-center gap-1.5">
            <BulletIcon tone={bullet.tone} />
              <span className="text-[11px] font-normal leading-snug text-standalone-text-secondary">{bullet.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function resolveInsight(
  data: BehavioralSnapshot | null | undefined,
  ezaScore: number | null | undefined,
  context: InsightContext
): InteractionInsightView {
  if (data?.vector) {
    return buildInteractionInsight(data, ezaScore);
  }
  return buildScoreOnlyInsight(ezaScore, context);
}

export default function BehavioralSummary({
  data,
  ezaScore,
  context = 'assistant',
  align = 'start',
}: BehavioralSummaryProps) {
  const [open, setOpen] = useState(false);
  const insight = resolveInsight(data, ezaScore, context);
  const hint =
    insight.bullets.find((b) => b.tone === 'positive')?.text ?? insight.bullets[0]?.text ?? '';
  const pending = ezaScore === undefined && insight.score === null;

  return (
    <div className={cn('max-w-full', align === 'end' && 'flex flex-col items-end')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex max-w-full items-center gap-1 rounded-full border border-standalone-border/70 bg-white/60 px-2 py-0.5 text-[11px] transition-colors hover:bg-white/90 touch-manipulation',
          align === 'end' ? 'text-right' : 'text-left'
        )}
        aria-expanded={open}
      >
        <InsightSummaryLabel score={insight.score} pending={pending} hint={hint} />
        <ChevronDown
          className={cn('h-2.5 w-2.5 shrink-0 text-standalone-text-muted/80 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? <ScoreDetailPanel insight={insight} /> : null}
    </div>
  );
}
