'use client';

import { cn } from '@/lib/utils';
import type { InteractionLayerView, RecentTurnHighlight } from '@/lib/eza/interactionLayers';

export function RecentTurnBanner({ turn }: { turn: RecentTurnHighlight }) {
  if (!turn.show) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
        Son etkileşim özeti
      </p>
      <p className="mt-2 text-base font-medium leading-snug text-amber-950/90">{turn.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-900/80">
        <span className="rounded-full bg-white/80 px-2.5 py-1">Girdi {turn.userRiskLabel}</span>
        <span className="rounded-full bg-white/80 px-2.5 py-1">Yanıt {turn.aiResponseLabel}</span>
        <span className="rounded-full bg-white/80 px-2.5 py-1">Uyum {turn.balanceLabel}</span>
      </div>
    </div>
  );
}

function LayerCard({
  layer,
  className,
}: {
  layer: InteractionLayerView;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-eza-border/70 bg-eza-surface p-5 shadow-eza-sm',
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-eza-text-muted">
        {layer.title}
      </p>
      <p className="mt-0.5 text-xs text-eza-text-secondary">{layer.subtitle}</p>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug text-eza-text">{layer.headline}</h3>
        <span className="shrink-0 rounded-full bg-eza-accent-muted px-2 py-0.5 text-xs font-medium text-eza-accent">
          {layer.level}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-eza-text-secondary">{layer.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {layer.kpis.map((kpi) => (
          <div key={kpi.label}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-eza-text-muted">
              {kpi.label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-eza-text">{kpi.value}</dd>
            {kpi.hint ? (
              <dd className="text-[11px] text-eza-text-muted">{kpi.hint}</dd>
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
}: {
  layers: InteractionLayerView[];
  variant?: 'default' | 'compact';
  className?: string;
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
        <LayerCard key={layer.id} layer={layer} />
      ))}
    </div>
  );
}
