'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrendChart from '@/components/eza/TrendChart';
import MetricCard from '@/components/eza/MetricCard';
import EmptyState from '@/components/eza/EmptyState';
import {
  InteractionLayersGrid,
  RecentTurnBanner,
} from '@/components/eza/InteractionLayersSection';
import {
  BEHAVIORAL_DISCLAIMER,
  buildBehavioralDashboard,
  type BehavioralDashboardModel,
  type EvidenceCard,
  type TendencyCard,
} from '@/lib/eza/behavioralDashboard';
import { buildInteractionInsight } from '@/lib/eza/behavioralInsights';
import { reportChartTheme, reportSkin } from '@/lib/eza/reportSkin';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

const SECTION_HOW = 'report-how';
const SECTION_PROFILE = 'report-profile';
const SECTION_TRENDS = 'report-trends';

interface BehavioralIntelligenceDashboardProps {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionShell({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-6 py-10 sm:py-12', className)}>
      <h2 className={reportSkin.sectionTitle}>{title}</h2>
      {subtitle ? <p className={reportSkin.sectionSub}>{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function WowMomentScreen({
  model,
  onScrollDown,
}: {
  model: BehavioralDashboardModel;
  onScrollDown: () => void;
}) {
  return (
    <section className={reportSkin.heroSection} aria-label="Davranışsal gözlem özeti">
      <div className={reportSkin.heroGlow} aria-hidden />
      <Link
        href="/standalone"
        className={cn('absolute left-4 top-4 sm:left-6 sm:top-6', reportSkin.link)}
      >
        ← Sohbete dön
      </Link>

      <p className={reportSkin.eyebrow}>Etkileşim Raporu</p>

      <blockquote className={reportSkin.wowQuote}>{model.wowMoment}</blockquote>

      {model.layers.recentTurn.show ? (
        <p className={reportSkin.heroSub}>{model.layers.recentTurn.summary}</p>
      ) : null}

      <p className={reportSkin.heroMuted}>
        EZA mesaj metnini saklamadan yalnızca sayısal etkileşim sinyallerini analiz eder.
      </p>

      <button
        type="button"
        onClick={() => scrollToSection(SECTION_HOW)}
        className={cn('mt-8 underline-offset-4 hover:underline', reportSkin.link)}
      >
        Bu nasıl hesaplandı?
      </button>

      <button
        type="button"
        onClick={onScrollDown}
        className="mt-14 flex flex-col items-center gap-1 text-xs text-stone-500 transition-colors hover:text-stone-700"
      >
        <span>Detayları gör</span>
        <ChevronDown className="h-5 w-5 animate-bounce" strokeWidth={2} aria-hidden />
      </button>
    </section>
  );
}

function EvidenceCardView({ card }: { card: EvidenceCard }) {
  return (
    <div className="rounded-2xl border border-standalone-border/55 bg-white/90 p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wide text-standalone-text-muted">
        {card.title}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-standalone-text">{card.value}</p>
      <p className="mt-2 text-sm leading-relaxed text-standalone-text-secondary">{card.description}</p>
      {card.meta ? (
        <p className="mt-2 text-xs text-standalone-text-muted">{card.meta}</p>
      ) : null}
    </div>
  );
}

function TendencyCardView({ card }: { card: TendencyCard }) {
  return (
    <div className={reportSkin.tendencyCard}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-stone-900">{card.title}</h4>
        <span className={reportSkin.tendencyBadge}>
          {card.level}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{card.description}</p>
      <div className={reportSkin.tendencyBarTrack}>
        <div
          className={reportSkin.tendencyBarFill}
          style={{ width: `${Math.max(4, card.value)}%` }}
        />
      </div>
    </div>
  );
}

function IntensityChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div
          key={d.label}
          className={reportSkin.intensityBar}
          style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
          title={`${d.label}: ${d.count}`}
        />
      ))}
    </div>
  );
}

function RawHistoryAccordion({
  entries,
  onClear,
}: {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recent = [...entries]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 15);

  if (entries.length === 0) return null;

  return (
    <section className="border-t border-standalone-border/40 py-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-standalone-border/50 bg-white/60 px-4 py-3.5 text-left transition-colors hover:bg-white/90 sm:px-5"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-standalone-text-secondary">
          Ham etkileşim geçmişini göster
          <span className="ml-2 font-normal text-standalone-text-muted">({entries.length})</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-standalone-text-muted transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-standalone-border/50 bg-white/80">
          <ul className="max-h-72 divide-y divide-standalone-border/30 overflow-y-auto">
            {recent.map((row, i) => {
              const insight = buildInteractionInsight(row, row.vector.eza_final ?? undefined);
              return (
                <li
                  key={`${row.interaction_id}-${row.savedAt}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <time className="text-standalone-text-muted" dateTime={row.savedAt}>
                    {new Date(row.savedAt).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  <span className="text-standalone-text-secondary">
                    {insight.score !== null ? `EZA ${insight.score}` : '—'}
                    <span className="mx-1.5 text-standalone-border">·</span>
                    {insight.bullets[0]?.text ?? '—'}
                  </span>
                </li>
              );
            })}
          </ul>
          {onClear ? (
            <div className="border-t border-standalone-border/40 px-4 py-3">
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1.5 text-sm text-red-600/85 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Tümünü temizle
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function BehavioralIntelligenceDashboard({
  entries,
  onClear,
}: BehavioralIntelligenceDashboardProps) {
  const model = useMemo(() => {
    try {
      return buildBehavioralDashboard(entries);
    } catch (e) {
      console.error('[behavioralDashboard] build failed', e);
      return null;
    }
  }, [entries]);
  const detailsRef = useRef<HTMLDivElement>(null);

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!model) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-stone-600">Rapor yüklenirken bir sorun oluştu. Sayfayı yenileyin.</p>
        <Link href="/standalone" className={cn('mt-4', reportSkin.link)}>
          ← Sohbete dön
        </Link>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <Link
          href="/standalone"
          className={cn('mb-8 self-start', reportSkin.link)}
        >
          ← Sohbete dön
        </Link>
        <p className={reportSkin.eyebrow}>Etkileşim Raporu</p>
        <p className="mt-6 max-w-md text-2xl font-medium leading-snug text-stone-900">
          Seni tanımak için biraz daha zaman gerekiyor.
        </p>
        <p className="mt-4 text-sm text-standalone-text-muted">
          Sohbette birkaç yanıt aldıktan sonra ilk davranışsal gözleminiz burada belirecek.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:mx-0">
      <WowMomentScreen model={model} onScrollDown={scrollToDetails} />

      <div
        ref={detailsRef}
        className={cn(reportSkin.detailsWrap, 'px-4 sm:px-0')}
      >
        <SectionShell
          id={SECTION_HOW}
          title="Bu gözlem neye dayanıyor?"
          subtitle={`${model.periodLabel} · ${model.periodCaption}`}
        >
          <RecentTurnBanner turn={model.layers.recentTurn} theme="report" />
          <InteractionLayersGrid layers={model.layers.layers} theme="report" />
        </SectionShell>

        <SectionShell
          id={SECTION_PROFILE}
          title="Üç katmanlı etkileşim profili"
          subtitle="Kullanıcı sinyalleri · AI yanıt davranışı · etkileşim dengesi"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {model.kpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                hint={kpi.hint}
                className={reportSkin.metricCard}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell
          id={SECTION_TRENDS}
          title="Trendler ve göstergeler"
          subtitle={model.ezaTrendCaption}
        >
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-sm font-medium text-stone-800">
                AI yanıt skoru zaman içinde
              </h3>
              {model.showTrendChart ? (
                <TrendChart
                  data={model.ezaTrend}
                  valueLabel="AI yanıt skoru"
                  height={200}
                  domain={[0, 100]}
                  className={reportSkin.chart}
                  chartTheme={reportChartTheme}
                />
              ) : (
                <EmptyState
                  title="Trend grafiği için en az 5 etkileşim gerekir"
                  description={`Şu an ${model.sampleCount} ölçüm var.`}
                  className="!border-stone-200/60 !bg-white/70"
                />
              )}
            </div>

            <div>
              <h3 className="mb-4 text-sm font-medium text-stone-800">
                Davranış ve eğilim göstergeleri
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {model.tendencyCards.map((card) => (
                  <TendencyCardView key={card.id} card={card} />
                ))}
              </div>
            </div>

            {model.intensityMode === 'day' && model.intensityByDay.some((d) => d.count > 0) ? (
              <div className="rounded-xl border border-stone-200/60 bg-white/80 p-4 shadow-sm">
                <h3 className="text-sm font-medium text-stone-800">{model.intensityTitle}</h3>
                <p className="mt-1 text-xs text-stone-500">{model.intensitySubtitle}</p>
                <div className="mt-4">
                  <IntensityChart data={model.intensityByDay} />
                </div>
                {model.intensityPeakLabel ? (
                  <p className="mt-2 text-xs text-stone-500">{model.intensityPeakLabel}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionShell>

        <RawHistoryAccordion entries={entries} onClear={onClear} />

        <p className={reportSkin.disclaimer}>{BEHAVIORAL_DISCLAIMER}</p>
      </div>
    </div>
  );
}
