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
    return <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} aria-hidden />;
  }
  if (tone === 'caution') {
    return <ShieldAlert className="h-3 w-3 text-amber-600" strokeWidth={2.5} aria-hidden />;
  }
  return <Minus className="h-3 w-3 text-standalone-text-muted" strokeWidth={2.5} aria-hidden />;
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
    <span className="truncate text-sm font-medium text-standalone-text-secondary">
      EZA Skoru{' '}
      {display !== null ? (
        <span className="tabular-nums font-semibold" style={{ color: scoreColor }}>
          {display}
        </span>
      ) : pending ? (
        <span className="tabular-nums font-semibold text-standalone-text-muted animate-pulse">…</span>
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
    <div className="mt-2 rounded-lg border border-standalone-border/80 bg-standalone-surface p-2.5 shadow-eza-sm">
      {display !== null ? (
        <div className="mb-2 flex items-baseline gap-2 border-b border-standalone-border/60 pb-2">
          <span className="text-xl font-semibold tabular-nums leading-none" style={{ color: scoreColor }}>
            {display}
          </span>
          <span className="text-sm font-medium text-standalone-text-muted">{getScoreRiskLabel(display)}</span>
        </div>
      ) : null}
      <ul className="space-y-1">
        {insight.bullets.map((bullet) => (
          <li key={bullet.text} className="flex items-center gap-2">
            <BulletIcon tone={bullet.tone} />
              <span className="text-xs font-normal text-standalone-text-secondary">{bullet.text}</span>
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
          'inline-flex max-w-full items-center gap-1.5 rounded-full border border-standalone-border/90 bg-standalone-muted/70 px-2.5 py-1 transition-colors hover:bg-standalone-muted touch-manipulation',
          align === 'end' ? 'text-right' : 'text-left'
        )}
        aria-expanded={open}
      >
        <InsightSummaryLabel score={insight.score} pending={pending} hint={hint} />
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-standalone-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? <ScoreDetailPanel insight={insight} /> : null}
    </div>
  );
}
