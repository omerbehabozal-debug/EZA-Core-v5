'use client';

import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildRelationshipMap,
  type RelationshipPeriodDays,
} from '@/lib/eza/relationshipMapModel';
import { buildRelationshipMapSharePayload } from '@/lib/eza/standaloneShare';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import BehaviorIslandsCluster from '@/components/standalone/BehaviorIslandsCluster';
import StandaloneShareModal from '@/components/standalone/StandaloneShareModal';

const s = standaloneSkin.relationshipMapPolish;
const mot = standaloneSkin.motion;
const sh = standaloneSkin.share;

interface RelationshipMapViewProps {
  entries: SavedBehavioralEntry[];
  className?: string;
  /** Side column on xl split layout — tighter chrome */
  variant?: 'full' | 'sidebar';
}

const PERIODS: { days: RelationshipPeriodDays; label: string }[] = [
  { days: 7, label: '7 Gün' },
  { days: 30, label: '30 Gün' },
  { days: 90, label: '90 Gün' },
];

function RhythmChart({ points }: { points: { label: string; value: number }[] }) {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className={s.rhythmChart} role="img" aria-label="Zaman içinde etkileşim ritmi">
      {points.map((p) => {
        const h = Math.max(12, Math.round((p.value / max) * 52));
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

export default function RelationshipMapView({
  entries,
  className,
  variant = 'full',
}: RelationshipMapViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodDays>(30);
  const [fadeKey, setFadeKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const isSidebar = variant === 'sidebar';

  const model = useMemo(() => buildRelationshipMap(entries, period), [entries, period]);
  const sharePayload = useMemo(() => buildRelationshipMapSharePayload(model), [model]);

  const handlePeriod = (days: RelationshipPeriodDays) => {
    if (days === period) return;
    setPeriod(days);
    setFadeKey((k) => k + 1);
  };

  const isEmpty = model.totalInteractions === 0;
  const anim = (cls: string) => (!reducedMotion ? cls : '');

  return (
    <section
      className={cn(s.section, isSidebar && 'pb-8 pt-2', className)}
      aria-label="EZA İlişki Haritası"
    >
      <div className={s.ambient} aria-hidden />

      <header className={s.headerRow}>
        <div>
          <h2
            className={cn(
              s.headerTitle,
              isSidebar && 'text-[1.25rem] sm:text-[1.35rem]'
            )}
          >
            EZA İlişki Haritası
          </h2>
          {!isSidebar ? (
            <p className={s.headerSub}>AI ile konuşma yolculuğunun uzun dönem deseni.</p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
              Uzun dönem etkileşim desenin.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className={cn(sh.triggerBtn, 'sm:self-start')}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Paylaş
        </button>
      </header>

      <div className={cn(s.topBar, isSidebar && 'mt-4')}>
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
        {!isEmpty ? (
          <article className={s.balanceMiniCard}>
            <p className={s.balanceMiniLabel}>Genel denge</p>
            <p className={s.balanceMiniValue}>{model.balanceSummary}</p>
          </article>
        ) : null}
      </div>

      <div key={fadeKey} className={cn(s.contentFade, mot.contentMorph, 'opacity-100')}>
        {!isEmpty ? (
          <article className={cn(s.editorialCard, anim(mot.fadeIn1), isSidebar && 'mt-4 p-4')}>
            <p className={s.editorialLabel}>EZA&apos;dan kısa not</p>
            <p className={s.editorialBody}>{model.editorialNote}</p>
          </article>
        ) : null}

        <section className={cn(s.islandsSection, isSidebar && 'mt-6')} aria-labelledby="behavior-islands-heading">
          <h3 id="behavior-islands-heading" className={s.islandsHeading}>
            Davranış adaları
          </h3>
          <p className={s.islandsSub}>
            Konuşma biçiminde öne çıkan gözlemsel alanlar — kişilik testi değil.
          </p>

          <div className={cn(s.islandsCanvas, anim(mot.fadeIn2), isSidebar && 'sm:min-h-[20rem]')}>
            {isEmpty ? (
              <div className={s.emptyIslands}>
                <p className={s.emptyTitle}>Harita henüz şekillenmedi</p>
                <p className={s.emptyBody}>
                  Birkaç sohbetten sonra davranış adaların burada yumuşak bir desen olarak
                  belirecek. Acele etmene gerek yok.
                </p>
              </div>
            ) : (
              <BehaviorIslandsCluster
                islands={model.islands}
                fadeKey={fadeKey}
                reducedMotion={reducedMotion}
              />
            )}
          </div>
        </section>

        {!isEmpty && !isSidebar ? (
          <div className={cn(s.chartsGrid, anim(mot.fadeIn3))}>
            <article className={cn(s.chartCard, anim(mot.fadeIn2))}>
              <h3 className={s.aiTitle}>AI davranış haritası</h3>
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

            <article className={cn(s.chartCard, anim(mot.fadeIn3))}>
              <h3 className={s.balanceTitle}>İlişki denge özeti</h3>
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
              <article className={cn(s.chartCard, anim(mot.fadeIn4))}>
                <h3 className={s.rhythmTitle}>Zaman içinde denge</h3>
                <p className={s.rhythmSub}>Günlük konuşma yoğunluğunun sakin özeti</p>
                <RhythmChart points={model.rhythmTimeline} />
              </article>
            ) : (
              <article className={cn(s.chartCard, anim(mot.fadeIn4), 'flex flex-col justify-center')}>
                <h3 className={s.rhythmTitle}>Etkileşim derinliği</h3>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-800">
                  {model.totalInteractions}
                  <span className="text-sm font-normal text-stone-500"> etkileşim</span>
                </p>
                <p className="mt-2 text-xs text-stone-500">Son {model.periodDays} gün</p>
              </article>
            )}
          </div>
        ) : null}
      </div>

      {!isSidebar ? (
        <p className={s.footerNote}>
          EZA analizleri gözlemsel desenler üretir; kesin karar yerine farkındalık sağlamayı amaçlar.
        </p>
      ) : null}

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
