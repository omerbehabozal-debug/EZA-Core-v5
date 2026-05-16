'use client';

import { cn } from '@/lib/utils';
import type { InteractionLayerView, RecentTurnHighlight } from '@/lib/eza/interactionLayers';

const layerReportStyles: Record<
  InteractionLayerView['id'],
  { card: string; badge: string }
> = {
  user: {
    card: 'border-amber-200/70 bg-gradient-to-br from-amber-50/50 via-white to-white',
    badge: 'bg-amber-100/90 text-amber-900',
  },
  assistant: {
    card: 'border-teal-200/70 bg-gradient-to-br from-teal-50/55 via-white to-white',
    badge: 'bg-teal-100/90 text-teal-900',
  },
  balance: {
    card: 'border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-white to-white',
    badge: 'bg-violet-100/90 text-violet-900',
  },
};

export function RecentTurnBanner({
  turn,
  theme = 'default',
}: {
  turn: RecentTurnHighlight;
  theme?: 'default' | 'report';
}) {
  if (!turn.show) return null;

  const isReport = theme === 'report';

  return (
    <div
      className={cn(
        'mb-6 rounded-2xl border p-4 sm:p-5',
        isReport
          ? 'border-stone-200/80 bg-gradient-to-r from-amber-50/60 via-report-muted/40 to-teal-50/50'
          : 'border-amber-200/60 bg-amber-50/50'
      )}
    >
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isReport ? 'text-report-ink-soft' : 'text-amber-900/70'
        )}
      >
        Son etkileşim özeti
      </p>
      <p
        className={cn(
          'mt-2 text-base font-medium leading-snug',
          isReport ? 'text-stone-800' : 'text-amber-950/90'
        )}
      >
        {turn.summary}
      </p>
      <div
        className={cn(
          'mt-3 flex flex-wrap gap-2 text-xs',
          isReport ? 'text-stone-600' : 'text-amber-900/80'
        )}
      >
        <span className="rounded-full bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-stone-200/50">
          Girdi {turn.userRiskLabel}
        </span>
        <span className="rounded-full bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-teal-200/50">
          Yanıt {turn.aiResponseLabel}
        </span>
        <span className="rounded-full bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-violet-200/40">
          Uyum {turn.balanceLabel}
        </span>
      </div>
    </div>
  );
}

function LayerCard({
  layer,
  className,
  theme = 'default',
}: {
  layer: InteractionLayerView;
  className?: string;
  theme?: 'default' | 'report';
}) {
  const isReport = theme === 'report';
  const reportLayer = layerReportStyles[layer.id];

  return (
    <article
      className={cn(
        'rounded-2xl border p-5 shadow-sm',
        isReport
          ? reportLayer.card
          : 'border-eza-border/70 bg-eza-surface shadow-eza-sm',
        className
      )}
    >
      <p
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wide',
          isReport ? 'text-stone-500' : 'text-eza-text-muted'
        )}
      >
        {layer.title}
      </p>
      <p
        className={cn(
          'mt-0.5 text-xs',
          isReport ? 'text-stone-500' : 'text-eza-text-secondary'
        )}
      >
        {layer.subtitle}
      </p>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3
          className={cn(
            'text-base font-semibold leading-snug',
            isReport ? 'text-stone-900' : 'text-eza-text'
          )}
        >
          {layer.headline}
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            isReport ? reportLayer.badge : 'bg-eza-accent-muted text-eza-accent'
          )}
        >
          {layer.level}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 text-sm leading-relaxed',
          isReport ? 'text-stone-600' : 'text-eza-text-secondary'
        )}
      >
        {layer.description}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {layer.kpis.map((kpi) => (
          <div key={kpi.label}>
            <dt
              className={cn(
                'text-[10px] font-medium uppercase tracking-wide',
                isReport ? 'text-stone-400' : 'text-eza-text-muted'
              )}
            >
              {kpi.label}
            </dt>
            <dd
              className={cn(
                'mt-0.5 text-sm font-semibold tabular-nums',
                isReport ? 'text-stone-900' : 'text-eza-text'
              )}
            >
              {kpi.value}
            </dd>
            {kpi.hint ? (
              <dd className={cn('text-[11px]', isReport ? 'text-stone-500' : 'text-eza-text-muted')}>
                {kpi.hint}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </article>
  );
}

export function InteractionLayersGrid({
  layers,
  variant = 'default',
  className,
  theme = 'default',
}: {
  layers: InteractionLayerView[];
  variant?: 'default' | 'compact';
  className?: string;
  theme?: 'default' | 'report';
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        variant === 'compact' ? 'sm:grid-cols-3' : 'lg:grid-cols-3',
        className
      )}
    >
      {layers.map((layer) => (
        <LayerCard key={layer.id} layer={layer} theme={theme} />
      ))}
    </div>
  );
}
