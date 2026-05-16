'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricCard, TrendChart, EmptyState } from '@/components/eza';
import SafeModeFeedbackBar from '@/components/governance/SafeModeFeedbackBar';
import {
  GOVERNANCE_REPORT_DISCLAIMER,
  type EvidenceCard,
  type GovernanceReportViewModel,
  type TendencyCard,
} from '@/lib/eza/governanceReportModel';

const SECTION_HOW = 'gov-report-how';
const SECTION_PROFILE = 'gov-report-profile';
const SECTION_TRENDS = 'gov-report-trends';

interface GovernanceInteractionReportViewProps {
  model: GovernanceReportViewModel;
  backHref?: string;
  backLabel?: string;
  headerActions?: React.ReactNode;
  loading?: boolean;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function WowHero({
  model,
  onScrollDetails,
  backHref,
  backLabel,
}: {
  model: GovernanceReportViewModel;
  onScrollDetails: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <section
      className="relative flex min-h-[min(85vh,720px)] flex-col items-center justify-center px-6 py-16 text-center"
      aria-label="Etkileşim gözlemi"
    >
      {backHref ? (
        <Link
          href={backHref}
          className="absolute left-0 top-0 text-sm font-medium text-eza-accent hover:text-eza-accent-hover"
        >
          {backLabel ?? '← Geri'}
        </Link>
      ) : null}

      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-eza-text-muted">
        Etkileşim Raporu
      </p>

      <blockquote className="mt-8 max-w-2xl text-2xl font-medium leading-snug tracking-[-0.03em] text-eza-text sm:text-[1.75rem] sm:leading-tight md:text-3xl">
        {model.wowMoment}
      </blockquote>

      <p className="mt-8 max-w-md text-sm leading-relaxed text-eza-text-muted">
        EZA yalnızca sayısal etkileşim sinyallerini analiz eder.
      </p>

      <button
        type="button"
        onClick={() => scrollToId(SECTION_HOW)}
        className="mt-8 text-sm font-medium text-eza-accent underline-offset-4 hover:underline"
      >
        Bu nasıl hesaplandı?
      </button>

      <button
        type="button"
        onClick={onScrollDetails}
        className="mt-16 flex flex-col items-center gap-1 text-xs text-eza-text-muted transition-colors hover:text-eza-text-secondary"
      >
        <span>Detayları gör</span>
        <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
      </button>
    </section>
  );
}

function EvidenceCardView({ card }: { card: EvidenceCard }) {
  return (
    <div className="rounded-2xl border border-eza-border/80 bg-eza-surface p-5 shadow-eza-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-eza-text-muted">
        {card.title}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-eza-text">
        {card.value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-eza-text-secondary">{card.description}</p>
      {card.meta ? (
        <span className="mt-3 inline-block rounded-full bg-eza-surface-muted px-2.5 py-0.5 text-[11px] text-eza-text-muted">
          {card.meta}
        </span>
      ) : null}
    </div>
  );
}

function TendencyCardView({ card }: { card: TendencyCard }) {
  return (
    <div className="rounded-xl border border-eza-border/70 bg-eza-surface p-4 shadow-eza-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-eza-text">{card.title}</h4>
        <span className="shrink-0 rounded-full bg-eza-accent-muted px-2 py-0.5 text-xs font-medium text-eza-accent">
          {card.level}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-eza-text-secondary">{card.description}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-eza-border/60">
        <div
          className="h-full rounded-full bg-eza-accent/70"
          style={{ width: `${Math.max(6, card.value)}%` }}
        />
      </div>
    </div>
  );
}

function HistoryAccordion({ model }: { model: GovernanceReportViewModel }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-eza-border/60 py-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-eza-border bg-eza-surface px-4 py-3.5 text-left transition-colors hover:bg-eza-surface-muted"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-eza-text-secondary">
          Ham etkileşim geçmişini göster
          {model.historyRows.length > 0 ? (
            <span className="ml-2 font-normal text-eza-text-muted">
              ({model.historyRows.length})
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-eza-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-eza-border bg-eza-surface">
          {model.historyRows.length > 0 ? (
            <ul className="max-h-64 divide-y divide-eza-border/50 overflow-y-auto">
              {model.historyRows.map((row) => (
                <li
                  key={`${row.label}-${row.score}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="text-eza-text-muted">{row.label}</span>
                  <span className="text-eza-text-secondary">
                    EZA {row.score}
                    <span className="mx-1.5 text-eza-border">·</span>
                    {row.note}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-eza-text-muted">
              Özet seri henüz oluşmadı. Birkaç etkileşim sonra ölçüm noktaları burada görünür.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function GovernanceInteractionReportView({
  model,
  backHref,
  backLabel,
  headerActions,
  loading,
}: GovernanceInteractionReportViewProps) {
  const detailsRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return <p className="py-20 text-center text-sm text-eza-text-muted">Yükleniyor…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <WowHero
        model={model}
        backHref={backHref}
        backLabel={backLabel}
        onScrollDetails={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      <div ref={detailsRef} className="border-t border-eza-border/40">
        <section id={SECTION_HOW} className="scroll-mt-8 py-12 sm:py-14">
          <h2 className="text-lg font-semibold text-eza-text sm:text-xl">
            Bu gözlem neye dayanıyor?
          </h2>
          <p className="mt-1 text-sm text-eza-text-secondary">{model.periodCaption}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {model.evidenceCards.map((card) => (
              <EvidenceCardView key={card.title} card={card} />
            ))}
          </div>
        </section>

        <section id={SECTION_PROFILE} className="scroll-mt-8 border-t border-eza-border/30 py-12 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-eza-text sm:text-xl">
                Genel etkileşim profili
              </h2>
              <p className="mt-1 text-sm text-eza-text-secondary">Özet göstergeler</p>
            </div>
            {headerActions}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {model.kpis.map((kpi) => (
              <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
            ))}
          </div>
        </section>

        <section id={SECTION_TRENDS} className="scroll-mt-8 border-t border-eza-border/30 py-12 sm:py-14">
          <h2 className="text-lg font-semibold text-eza-text sm:text-xl">
            Trendler ve göstergeler
          </h2>
          <p className="mt-1 text-sm text-eza-text-secondary">{model.ezaTrendCaption}</p>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-eza-text">EZA skoru zaman içinde</h3>
            {model.showTrendChart ? (
              <TrendChart data={model.ezaTrend} valueLabel="EZA skoru" height={220} domain={[0, 100]} />
            ) : (
              <EmptyState
                title="Trend grafiği için en az 5 etkileşim gerekir"
                description={`Şu an ${model.sampleCount} ölçüm var.`}
              />
            )}
          </div>

          <div className="mt-10">
            <h3 className="mb-4 text-sm font-medium text-eza-text">Davranış göstergeleri</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {model.tendencyCards.map((card) => (
                <TendencyCardView key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>

        {(model.feedbackEventId || model.feedbackAnalysisId) && (
          <section className="border-t border-eza-border/30 py-8">
            <p className="mb-3 text-xs text-eza-text-muted">Kalibrasyon geri bildirimi (isteğe bağlı)</p>
            <SafeModeFeedbackBar
              eventId={model.feedbackEventId}
              analysisId={model.feedbackAnalysisId}
              metricName={model.feedbackMetric}
            />
          </section>
        )}

        <HistoryAccordion model={model} />

        <p className="pb-12 text-center text-xs leading-relaxed text-eza-text-muted">
          {GOVERNANCE_REPORT_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
