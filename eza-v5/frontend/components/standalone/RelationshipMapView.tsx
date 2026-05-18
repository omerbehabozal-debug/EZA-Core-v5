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
  { days: 7, label: '7 Gün' },
  { days: 30, label: '30 Gün' },
  { days: 90, label: '90 Gün' },
];

function islandMinHeight(intensity: number): string {
  const px = Math.round(88 + intensity * 56);
  return `${px}px`;
}

function islandOpacity(trend: BehaviorIsland['trend']): number {
  if (trend === 'growing') return 1;
  if (trend === 'fading') return 0.72;
  return 0.88;
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
        borderColor: `${island.color}44`,
        background: `linear-gradient(145deg, ${island.color}14, ${island.color}28)`,
        opacity: islandOpacity(trend),
        boxShadow:
          trend === 'growing'
            ? `0 8px 32px -8px ${island.color}33`
            : `0 4px 20px -10px ${island.color}22`,
        animationDelay: reducedMotion ? undefined : `${index * 0.07}s`,
      }}
    >
      {memoryEffect ? <div className={s.connectionHint} aria-hidden /> : null}
      <div
        className={s.islandGlow}
        style={{ background: `radial-gradient(circle, ${island.color}55, transparent 70%)` }}
        aria-hidden
      />
      <h4 className={s.islandLabel}>{island.label}</h4>
      <p className={s.islandDesc}>{island.description}</p>
      <div className={s.islandMeta}>
        <span className={s.islandTrendPill}>{TREND_LABEL[trend]}</span>
        <span className={s.islandPercentMuted} aria-label={`Göreli yoğunluk yüzde ${island.percent}`}>
          · {island.percent}%
        </span>
      </div>
    </article>
  );
}

function RhythmChart({ points }: { points: { label: string; value: number }[] }) {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className={s.rhythmChart} role="img" aria-label="Zaman içinde etkileşim ritmi">
      {points.map((p) => {
        const h = Math.max(12, Math.round((p.value / max) * 48));
        return (
          <div key={p.label} className={s.rhythmDotWrap}>
            <div
              className={s.rhythmDot}
              style={{ height: `${h}px` }}
              title={`${p.label}: ${p.value} etkileşim`}
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
    <section className={cn(s.section, className)} aria-label="EZA İlişki Haritası">
      <div className={s.ambient} aria-hidden />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={s.headerTitle}>EZA İlişki Haritası</h2>
          <p className={s.headerSub}>AI ile konuşma yolculuğunun uzun dönem deseni.</p>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className={sh.triggerBtn}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Paylaş
        </button>
      </header>

      <div className={s.periodRow} role="tablist" aria-label="Dönem seçimi">
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

      <div
        key={fadeKey}
        className={cn(s.contentFade, mot.contentMorph, 'opacity-100')}
      >
        {!isEmpty ? (
          <article className={cn(s.editorialCard, 'mt-8')}>
            <p className={s.editorialLabel}>EZA&apos;dan kısa not</p>
            <p className={s.editorialBody}>{model.editorialNote}</p>
          </article>
        ) : null}

        <section className={s.islandsSection} aria-labelledby="behavior-islands-heading">
          <h3 id="behavior-islands-heading" className={s.islandsHeading}>
            Davranış Adaları
          </h3>
          <p className={s.islandsSub}>
            Konuşma biçiminde öne çıkan gözlemsel alanlar — kişilik testi değil.
          </p>

          <div className={s.islandsLayout}>
            <div className={s.islandsMain}>
              {isEmpty ? (
                <div className={s.emptyIslands}>
                  <p className={s.emptyTitle}>Harita henüz şekillenmedi</p>
                  <p className={s.emptyBody}>
                    Birkaç sohbetten sonra davranış adaların burada yumuşak bir desen olarak
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

            {!isEmpty ? (
              <div className={s.sideStack}>
                <article className={s.aiCard}>
                  <h3 className={s.aiTitle}>AI sana nasıl yanıt verdi?</h3>
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

                <article className={s.balanceCard}>
                  <h3 className={s.balanceTitle}>Aranızdaki denge</h3>
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
              </div>
            ) : null}
          </div>
        </section>

        {!isEmpty && model.rhythmTimeline.length > 1 ? (
          <section className={s.rhythmSection} aria-labelledby="rhythm-heading">
            <h3 id="rhythm-heading" className={s.rhythmTitle}>
              Zaman içinde etkileşim ritmi
            </h3>
            <p className={s.rhythmSub}>Günlük konuşma yoğunluğunun sakin özeti</p>
            <RhythmChart points={model.rhythmTimeline} />
          </section>
        ) : null}
      </div>

      <p className={s.footerNote}>
        EZA analizleri gözlemsel desenler üretir; kesin karar yerine farkındalık sağlamayı amaçlar.
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
            <p className={sh.cardRow}>Henüz belirgin bir ada oluşmadı.</p>
          )}
          <p className={sh.cardWatermark}>eza.global</p>
        </div>
      </StandaloneShareModal>
    </section>
  );
}
