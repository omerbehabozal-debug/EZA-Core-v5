'use client';

import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildRelationshipMap,
  TREND_LABEL,
  type BehaviorIsland,
  type RelationshipPeriodDays,
} from '@/lib/eza/relationshipMapModel';
import { buildRelationshipMapSharePayload } from '@/lib/eza/standaloneShare';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import StandaloneShareModal from '@/components/standalone/StandaloneShareModal';

const s = standaloneSkin.relationshipMapPolish;
const mot = standaloneSkin.motion;
const sh = standaloneSkin.share;

interface RelationshipMapViewProps {
  entries: SavedBehavioralEntry[];
  className?: string;
}

const PERIODS: { days: RelationshipPeriodDays; label: string }[] = [
  { days: 7, label: '7 GÃ¼n' },
  { days: 30, label: '30 GÃ¼n' },
  { days: 90, label: '90 GÃ¼n' },
];

function islandMinHeight(intensity: number): string {
  const px = Math.round(100 + intensity * 64);
  return `${px}px`;
}

function islandOpacity(trend: BehaviorIsland['trend']): number {
  if (trend === 'growing') return 1;
  if (trend === 'fading') return 0.76;
  return 0.9;
}

function BehaviorIslandBlob({
  island,
  index,
  reducedMotion,
}: {
  island: BehaviorIsland;
  index: number;
  reducedMotion: boolean;
}) {
  const trend = island.trend ?? 'stable';
  const memoryEffect = island.percent < 8;

  return (
    <article
      className={cn(
        s.islandBlob,
        !reducedMotion && mot.islandEnter,
        trend === 'growing' && s.islandGrowing,
        trend === 'fading' && s.islandFading,
        memoryEffect && s.islandGhost
      )}
      style={{
        minHeight: islandMinHeight(island.intensity),
        borderColor: `${island.color}55`,
        background: `linear-gradient(155deg, ${island.color}18, ${island.color}32)`,
        opacity: islandOpacity(trend),
        boxShadow:
          trend === 'growing'
            ? `0 12px 40px -10px ${island.color}40`
            : `0 6px 28px -12px ${island.color}28`,
        animationDelay: reducedMotion ? undefined : `${index * 0.07}s`,
      }}
    >
      {memoryEffect ? <div className={s.connectionHint} aria-hidden /> : null}
      <div
        className={s.islandGlow}
        style={{ background: `radial-gradient(circle, ${island.color}60, transparent 72%)` }}
        aria-hidden
      />
      <h4 className={s.islandLabel}>{island.label}</h4>
      <p className={s.islandDesc}>{island.description}</p>
      <div className={s.islandMeta}>
        <span className={s.islandTrendPill}>{TREND_LABEL[trend]}</span>
        <span className={s.islandPercentMuted} aria-label={`GÃ¶reli yoÄŸunluk yÃ¼zde ${island.percent}`}>
          Â· {island.percent}%
        </span>
      </div>
    </article>
  );
}

function RhythmChart({ points }: { points: { label: string; value: number }[] }) {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className={s.rhythmChart} role="img" aria-label="Zaman iÃ§inde etkileÅŸim ritmi">
      {points.map((p) => {
        const h = Math.max(12, Math.round((p.value / max) * 52));
        return (
          <div key={p.label} className={s.rhythmDotWrap}>
            <div
              className={s.rhythmDot}
              style={{ height: `${h}px` }}
              title={`${p.label}: ${p.value} etkileÅŸim`}
            />
            <span className={s.rhythmLabel}>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RelationshipMapView({ entries, className }: RelationshipMapViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodDays>(30);
  const [fadeKey, setFadeKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const model = useMemo(
    () => buildRelationshipMap(entries, period),
    [entries, period]
  );

  const sharePayload = useMemo(() => buildRelationshipMapSharePayload(model), [model]);

  const handlePeriod = (days: RelationshipPeriodDays) => {
    if (days === period) return;
    setPeriod(days);
    setFadeKey((k) => k + 1);
  };

  const isEmpty = model.totalInteractions === 0;

  return (
    <section className={cn(s.section, className)} aria-label="EZA Ä°liÅŸki HaritasÄ±">
      <div className={s.ambient} aria-hidden />

      <header className={s.headerRow}>
        <div>
          <h2 className={s.headerTitle}>EZA Ä°liÅŸki HaritasÄ±</h2>
          <p className={s.headerSub}>AI ile konuÅŸma yolculuÄŸunun uzun dÃ¶nem deseni.</p>
        </div>
        <button type="button" onClick={() => setShareOpen(true)} className={sh.triggerBtn}>
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          PaylaÅŸ
        </button>
      </header>

      <div className={s.topBar}>
        <div className={s.periodRow} role="tablist" aria-label="DÃ¶nem seÃ§imi">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="tab"
              aria-selected={period === p.days}
              onClick={() => handlePeriod(p.days)}
              className={cn(
                s.periodPill,
                period === p.days ? s.periodPillActive : s.periodPillIdle
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {!isEmpty ? (
          <article className={s.balanceMiniCard}>
            <p className={s.balanceMiniLabel}>Genel denge</p>
            <p className={s.balanceMiniValue}>{model.balanceSummary}</p>
          </article>
        ) : null}
      </div>

      <div key={fadeKey} className={cn(s.contentFade, mot.contentMorph, 'opacity-100')}>
        {!isEmpty ? (
          <article className={s.editorialCard}>
            <p className={s.editorialLabel}>EZA&apos;dan kÄ±sa not</p>
            <p className={s.editorialBody}>{model.editorialNote}</p>
          </article>
        ) : null}

        <section className={s.islandsSection} aria-labelledby="behavior-islands-heading">
          <h3 id="behavior-islands-heading" className={s.islandsHeading}>
            DavranÄ±ÅŸ adalarÄ±
          </h3>
          <p className={s.islandsSub}>
            KonuÅŸma biÃ§iminde Ã¶ne Ã§Ä±kan gÃ¶zlemsel alanlar â€” kiÅŸilik testi deÄŸil.
          </p>

          <div className={s.islandsCanvas}>
            {isEmpty ? (
              <div className={s.emptyIslands}>
                <p className={s.emptyTitle}>Harita henÃ¼z ÅŸekillenmedi</p>
                <p className={s.emptyBody}>
                  BirkaÃ§ sohbetten sonra davranÄ±ÅŸ adalarÄ±n burada yumuÅŸak bir desen olarak
                  belirecek. Acele etmene gerek yok.
                </p>
              </div>
            ) : (
              <div className={s.islandsGrid}>
                {model.islands.map((island, index) => (
                  <BehaviorIslandBlob
                    key={`${island.id}-${fadeKey}`}
                    island={island}
                    index={index}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {!isEmpty ? (
          <div className={s.chartsGrid}>
            <article className={s.chartCard}>
              <h3 className={s.aiTitle}>AI davranÄ±ÅŸ haritasÄ±</h3>
              <ul className={s.aiToneRow}>
                {model.aiBehaviorTones.map((tone) => (
                  <li key={tone.label} className={s.aiToneItem}>
                    <span className={s.aiToneLabel}>{tone.label}</span>
                    <div className={s.aiToneTrack}>
                      <div
                        className={s.aiToneFill}
                        style={{ width: `${Math.round(tone.intensity * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className={s.chartCard}>
              <h3 className={s.balanceTitle}>Ä°liÅŸki denge Ã¶zeti</h3>
              <p className={s.balanceSummary}>{model.balanceSummary}</p>
              <div className={s.balancePillRow}>
                {model.balancePills.map((pill) => (
                  <span
                    key={pill.label}
                    className={cn(
                      s.balancePill,
                      pill.active ? s.balancePillActive : s.balancePillIdle
                    )}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            </article>

            {model.rhythmTimeline.length > 1 ? (
              <article className={s.chartCard}>
                <h3 className={s.rhythmTitle}>Zaman iÃ§inde denge</h3>
                <p className={s.rhythmSub}>GÃ¼nlÃ¼k konuÅŸma yoÄŸunluÄŸunun sakin Ã¶zeti</p>
                <RhythmChart points={model.rhythmTimeline} />
              </article>
            ) : (
              <article className={cn(s.chartCard, 'flex flex-col justify-center')}>
                <h3 className={s.rhythmTitle}>EtkileÅŸim derinliÄŸi</h3>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-800">
                  {model.totalInteractions}
                  <span className="text-sm font-normal text-stone-500"> etkileÅŸim</span>
                </p>
                <p className="mt-2 text-xs text-stone-500">Son {model.periodDays} gÃ¼n</p>
              </article>
            )}
          </div>
        ) : null}
      </div>

      <p className={s.footerNote}>
        EZA analizleri gÃ¶zlemsel desenler Ã¼retir; kesin karar yerine farkÄ±ndalÄ±k saÄŸlamayÄ± amaÃ§lar.
      </p>

      <StandaloneShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareTitle={sharePayload.title}
        clipboardText={sharePayload.clipboardText}
      >
        <div className={sh.card}>
          <p className={sh.cardLogo}>EZA</p>
          <p className="mt-1 text-xs text-stone-500">{sharePayload.periodLabel}</p>
          <p className={sh.cardInsight}>{sharePayload.editorialNote}</p>
          {sharePayload.topIslands.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {sharePayload.topIslands.map((island) => (
                <li key={island.label} className={sh.cardRow}>
                  <span className="font-medium text-stone-700">{island.label}: </span>
                  {island.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className={sh.cardRow}>HenÃ¼z belirgin bir ada oluÅŸmadÄ±.</p>
          )}
          <p className={sh.cardWatermark}>eza.global</p>
        </div>
      </StandaloneShareModal>
    </section>
  );
}
