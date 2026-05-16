'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricCard, TrendChart, EmptyState } from '@/components/eza';
import SafeModeFeedbackBar from '@/components/governance/SafeModeFeedbackBar';
import {
  GOVERNANCE_REPORT_DISCLAIMER,
  GOVERNANCE_SIGNAL_NOTE,
  type EvidenceCard,
  type FeaturedInteractionView,
  type GovernanceReportViewModel,
  type TendencyCard,
} from '@/lib/eza/governanceReportModel';
import { reportChartTheme, reportSkin } from '@/lib/eza/reportSkin';
import DailyObservationCard from '@/components/governance/DailyObservationCard';

const SECTION_FEATURED = 'gov-report-featured';
const SECTION_HOW = 'gov-report-how';
const SECTION_PROFILE = 'gov-report-profile';
const SECTION_TRENDS = 'gov-report-trends';

interface GovernanceInteractionReportViewProps {
  model: GovernanceReportViewModel;
  backHref?: string;
  backLabel?: string;
  headerActions?: React.ReactNode;
  loading?: boolean;
  /** Varsayılan: governance sinyal notu */
  signalNote?: string;
  /** Trend grafiği ekseni (standalone: AI yanıt skoru) */
  trendValueLabel?: string;
  onClearHistory?: () => void;
  /** Standalone shell zaten arka plan veriyor */
  embeddedInStandalone?: boolean;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function WowHero({
  model,
  onScrollDetails,
  onOpenHow,
  backHref,
  backLabel,
  signalNote,
}: {
  model: GovernanceReportViewModel;
  onScrollDetails: () => void;
  onOpenHow: () => void;
  backHref?: string;
  backLabel?: string;
  signalNote: string;
}) {
  const openHow = () => {
    onOpenHow();
    scrollToId(SECTION_HOW);
  };

  return (
    <section
      className={cn(reportSkin.heroSection, 'min-h-[min(100svh,880px)] px-6 py-20')}
      aria-label="Etkileşim gözlemi"
    >
      <div className={reportSkin.heroGlow} aria-hidden />
      {backHref ? (
        <Link href={backHref} className={cn('absolute left-0 top-0', reportSkin.link)}>
          {backLabel ?? '← Geri'}
        </Link>
      ) : null}

      <p className={reportSkin.eyebrow}>Etkileşim Raporu</p>

      <blockquote className={cn(reportSkin.wowQuote, 'max-w-2xl text-[1.65rem] sm:text-3xl')}>
        {model.wowMoment}
      </blockquote>

      <p className={reportSkin.heroMuted}>{signalNote}</p>

      <button type="button" onClick={openHow} className={reportSkin.heroHowLink}>
        Bu nasıl hesaplandı?
      </button>

      <button type="button" onClick={onScrollDetails} className={reportSkin.scrollHint}>
        <span>Detayları gör</span>
        <ChevronDown className="h-4 w-4 opacity-60" strokeWidth={1.5} aria-hidden />
      </button>
    </section>
  );
}

function FeaturedRow({
  emoji,
  label,
  sentence,
}: {
  emoji: string;
  label: string;
  sentence: string;
}) {
  return (
    <div className={reportSkin.featuredRow}>
      <span className={reportSkin.featuredEmoji} aria-hidden>
        {emoji}
      </span>
      <div>
        <p className={reportSkin.featuredLabel}>{label}</p>
        <p className={reportSkin.featuredSentence}>{sentence}</p>
      </div>
    </div>
  );
}

function FeaturedInteractionSection({ featured }: { featured: FeaturedInteractionView }) {
  if (!featured.show) return null;

  return (
    <section id={SECTION_FEATURED} className="scroll-mt-8 py-14 sm:py-16">
      <h2 className={reportSkin.sectionTitle}>Son Etkileşim</h2>

      <div className={reportSkin.featuredBlock}>
        <FeaturedRow emoji="🟠" label="Kullanıcı sinyali" sentence={featured.userSignal} />
        <FeaturedRow emoji="🟢" label="AI davranışı" sentence={featured.aiBehavior} />
        <FeaturedRow emoji="🔵" label="Etkileşim dengesi" sentence={featured.balance} />
        <p className={reportSkin.featuredFootnote}>{featured.footnote}</p>
      </div>
    </section>
  );
}

function EvidenceCardView({ card }: { card: EvidenceCard }) {
  return (
    <div className={reportSkin.evidenceSoft}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{card.title}</p>
      <p className={reportSkin.evidenceValue}>{card.value}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{card.description}</p>
      {card.meta ? (
        <span className="mt-3 inline-block rounded-full bg-report-muted px-2.5 py-0.5 text-[11px] text-report-ink">
          {card.meta}
        </span>
      ) : null}
    </div>
  );
}

function HowCalculatedSection({
  model,
  open,
  onToggle,
}: {
  model: GovernanceReportViewModel;
  open: boolean;
  onToggle: () => void;
}) {
  const howCalculated = model.howCalculated ?? {
    cards: [],
    signalFootnote: '',
    confidenceLabel: null,
    reliabilityLabel: null,
  };

  return (
    <section id={SECTION_HOW} className="scroll-mt-8 border-t border-stone-200/50 py-10 sm:py-12">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className={reportSkin.sectionTitle}>Bu gözlem neye dayanıyor?</h2>
          <p className={reportSkin.sectionSub}>{model.periodCaption}</p>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-stone-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {howCalculated.cards.map((card) => (
              <EvidenceCardView key={card.title} card={card} />
            ))}
          </div>
          <p className="text-sm leading-relaxed text-stone-500">{howCalculated.signalFootnote}</p>
        </div>
      ) : null}
    </section>
  );
}

function TendencyCardView({ card }: { card: TendencyCard }) {
  return (
    <div className={reportSkin.tendencySoft}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-stone-900">{card.title}</h4>
        <span className={reportSkin.tendencyBadge}>{card.level}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{card.description}</p>
      <div className={reportSkin.tendencyBarTrack}>
        <div className={reportSkin.tendencyBarFill} style={{ width: `${Math.max(6, card.value)}%` }} />
      </div>
    </div>
  );
}

function HistoryAccordion({
  model,
  onClearHistory,
}: {
  model: GovernanceReportViewModel;
  onClearHistory?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (model.historyRows.length === 0 && !onClearHistory) return null;

  return (
    <section className="border-t border-stone-200/40 py-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200/50 bg-stone-50/50 px-4 py-3 text-left transition-colors hover:bg-stone-50"
        aria-expanded={open}
      >
        <span className="text-sm text-stone-500">
          Ham etkileşim geçmişini göster
          {model.historyRows.length > 0 ? (
            <span className="ml-2 font-normal text-stone-400">({model.historyRows.length})</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-stone-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-stone-200/40 bg-stone-50/30">
          {model.historyRows.length > 0 ? (
            <ul className="max-h-64 divide-y divide-stone-200/30 overflow-y-auto">
              {model.historyRows.map((row) => (
                <li
                  key={`${row.label}-${row.score}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="text-stone-400">{row.label}</span>
                  <span className="text-stone-500">
                    EZA {row.score}
                    <span className="mx-1.5 text-stone-300">·</span>
                    {row.note}
                    {row.tags?.length ? (
                      <span className="ml-2 rounded bg-stone-200/60 px-1.5 py-0.5 text-[10px] text-stone-500">
                        {row.tags[0]}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-stone-400">
              Özet seri henüz oluşmadı. Birkaç etkileşim sonra ölçüm noktaları burada görünür.
            </p>
          )}
          {onClearHistory ? (
            <div className="border-t border-stone-200/30 px-4 py-3">
              <button
                type="button"
                onClick={onClearHistory}
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

export default function GovernanceInteractionReportView({
  model,
  backHref,
  backLabel,
  headerActions,
  loading,
  signalNote = GOVERNANCE_SIGNAL_NOTE,
  trendValueLabel = 'EZA skoru',
  onClearHistory,
  embeddedInStandalone = false,
}: GovernanceInteractionReportViewProps) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const [howOpen, setHowOpen] = useState(false);

  if (loading) {
    return <p className="py-20 text-center text-sm text-stone-500">Yükleniyor…</p>;
  }

  const profileKpis = model.profileKpis ?? [];
  const tendencyCards = model.tendencyCards ?? [];
  const featured = model.featuredInteraction ?? {
    show: false,
    userSignal: '',
    aiBehavior: '',
    balance: '',
    footnote: '',
  };

  return (
    <div
      className={cn(
        'mx-auto max-w-3xl',
        !embeddedInStandalone && reportSkin.canvas
      )}
    >
      <WowHero
        model={model}
        backHref={backHref}
        backLabel={backLabel}
        signalNote={signalNote}
        onOpenHow={() => setHowOpen(true)}
        onScrollDetails={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {model.dailyObservation?.show ? (
        <div className="px-4 pb-2 pt-4 sm:px-0 sm:pb-4">
          <DailyObservationCard observation={model.dailyObservation} />
        </div>
      ) : null}

      <div ref={detailsRef} className={reportSkin.detailsWrap}>
        <FeaturedInteractionSection featured={featured} />

        <HowCalculatedSection model={model} open={howOpen} onToggle={() => setHowOpen((o) => !o)} />

        <section id={SECTION_PROFILE} className="scroll-mt-8 border-t border-stone-200/50 py-12 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className={reportSkin.sectionTitle}>Genel etkileşim profili</h2>
              <p className={reportSkin.sectionSub}>Özet göstergeler — gözlemsel sinyaller</p>
            </div>
            {headerActions}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {profileKpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                hint={kpi.hint}
                className={reportSkin.metricCard}
              />
            ))}
          </div>
        </section>

        <section id={SECTION_TRENDS} className="scroll-mt-8 border-t border-stone-200/50 py-12 sm:py-14">
          <h2 className={reportSkin.sectionTitle}>Trendler ve göstergeler</h2>
          <p className={reportSkin.sectionSub}>{model.ezaTrendCaption}</p>

          {model.trendCredibilityNote ? (
            <p className={cn(reportSkin.trendCredibility, 'mt-4')}>{model.trendCredibilityNote}</p>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,minmax(0,13rem)] lg:items-start">
            <div>
              <h3 className="mb-3 text-sm font-medium text-stone-800">EZA skoru zaman içinde</h3>
              {model.showTrendChart ? (
                <TrendChart
                  data={model.ezaTrend}
                  valueLabel={trendValueLabel}
                  height={220}
                  domain={[0, 100]}
                  className={reportSkin.chart}
                  chartTheme={reportChartTheme}
                />
              ) : (
                <EmptyState
                  title="Trend grafiği için en az 5 etkileşim gerekir"
                  description={
                    model.sampleCount > 0
                      ? `Şu an ${model.sampleCount} ölçüm var.`
                      : 'Birkaç etkileşim sonra trend burada belirecek.'
                  }
                  className="!border-stone-200/60 !bg-white/70"
                />
              )}
            </div>
            <aside className="rounded-xl border border-stone-200/50 bg-report-muted/40 p-4 lg:mt-8">
              <p className="text-[11px] font-medium uppercase tracking-wide text-report-ink-soft">
                Gözlem
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">
                {model.trendInsight || 'Trend için yeterli veri toplanıyor.'}
              </p>
            </aside>
          </div>

          <div className="mt-10">
            <h3 className="mb-4 text-sm font-medium text-stone-800">Davranış göstergeleri</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {tendencyCards.map((card) => (
                <TendencyCardView key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>

        {(model.feedbackEventId || model.feedbackAnalysisId) && (
          <section className="border-t border-stone-200/40 py-8">
            <p className="mb-3 text-xs text-stone-500">Kalibrasyon geri bildirimi (isteğe bağlı)</p>
            <SafeModeFeedbackBar
              eventId={model.feedbackEventId}
              analysisId={model.feedbackAnalysisId}
              metricName={model.feedbackMetric}
            />
          </section>
        )}

        <HistoryAccordion model={model} onClearHistory={onClearHistory} />

        <p className={reportSkin.disclaimer}>{GOVERNANCE_REPORT_DISCLAIMER}</p>
      </div>
    </div>
  );
}
