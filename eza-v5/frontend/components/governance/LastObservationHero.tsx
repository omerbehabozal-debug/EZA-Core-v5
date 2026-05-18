'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { MIRROR_LABELS, STANDALONE_OBSERVATION_SUB } from '@/lib/eza/presentationTone';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { reportSkin } from '@/lib/eza/reportSkin';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface LastObservationHeroProps {
  observation: DailyObservationView;
  onScrollDetails: () => void;
  className?: string;
  personaSeed?: string;
}

function MirrorRow({ label, sentence }: { label: string; sentence: string }) {
  return (
    <div className={reportSkin.obsMirrorRow}>
      <p className={reportSkin.obsMirrorLabel}>{label}</p>
      <p className={reportSkin.obsMirrorSentence}>{sentence}</p>
    </div>
  );
}

export default function LastObservationHero({
  observation,
  onScrollDetails,
  className,
  personaSeed = 'standalone-persona',
}: LastObservationHeroProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const mirror = MIRROR_LABELS.standalone;
  const persona = pickStandalonePersona(observation.categoryId, personaSeed);

  const insight =
    observation.primaryInsight ||
    observation.manset ||
    'Son konuşmalarından henüz belirgin bir gözlem oluşmadı.';

  return (
    <section
      className={cn(reportSkin.observationHero, className)}
      aria-label="EZA'nın son gözlemi"
    >
      <div className={reportSkin.observationHeroGlow} aria-hidden />

      <p className={reportSkin.observationHeroEyebrow}>EZA&apos;nın Son Gözlemi</p>
      <p className={reportSkin.observationHeroSub}>{STANDALONE_OBSERVATION_SUB}</p>

      {observation.priorityAlert?.show ? (
        <div className={reportSkin.observationPriorityBlock} role="alert">
          <p className={reportSkin.observationPriorityEyebrow}>Öncelikli gözlem</p>
          <blockquote className={reportSkin.observationPriorityHeadline}>
            {observation.priorityAlert.headline}
          </blockquote>
          <p className={reportSkin.observationPriorityHint}>
            {observation.priorityAlert.interactionHint}
          </p>
          <p className={reportSkin.observationPriorityDetail}>{observation.priorityAlert.detail}</p>
        </div>
      ) : null}

      {observation.priorityAlert?.show ? (
        <>
          <p className={reportSkin.observationGeneralLabel}>Genel akış özeti</p>
          <blockquote className={reportSkin.observationHeroInsightSecondary}>{insight}</blockquote>
        </>
      ) : (
        <blockquote className={reportSkin.observationHeroInsight}>{insight}</blockquote>
      )}

      <div className={standaloneSkin.personaChip}>
        <span className={standaloneSkin.personaChipEmoji} aria-hidden>
          {persona.emoji}
        </span>
        <span className={standaloneSkin.personaChipLabel}>
          Bugünkü enerjin: {persona.name}
        </span>
      </div>

      <p className={reportSkin.observationHeroSupport}>{observation.supportLine}</p>

      <div className={reportSkin.obsMirrorBlock}>
        <MirrorRow label={mirror.user} sentence={observation.userLine} />
        <MirrorRow label={mirror.ai} sentence={observation.aiLine} />
        <MirrorRow label={mirror.balance} sentence={observation.balanceLine} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className={reportSkin.dailyPill}>{observation.signalLevel}</span>
        {observation.confidenceLabel ? (
          <span className={reportSkin.dailyPill}>{observation.confidenceLabel}</span>
        ) : null}
      </div>

      {observation.showWeekPattern && observation.weekPattern.length > 0 ? (
        <div className={reportSkin.dailyPatternBlock}>
          <p className={reportSkin.dailyPatternCaption}>Son etkileşimler</p>
          <div
            className={reportSkin.dailyPatternDots}
            role="list"
            aria-label="Son etkileşim desenleri"
          >
            {observation.weekPattern.map((dot, index) => (
              <span
                key={`${dot.hoverTitle}-${index}`}
                role="listitem"
                className={cn(
                  reportSkin.dailyPatternDot,
                  dot.isLatest && reportSkin.dailyPatternDotLatest
                )}
                title={dot.hoverTitle}
              >
                <span className="text-[11px] leading-none" aria-hidden>
                  {dot.emoji}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {observation.yesterdayLine ? (
        <p className={reportSkin.dailyYesterday}>{observation.yesterdayLine}</p>
      ) : null}

      {observation.fridaySummary ? (
        <p className={reportSkin.dailyFriday}>{observation.fridaySummary}</p>
      ) : null}

      <div className="mt-8 border-t border-stone-200/40 pt-5">
        <button
          type="button"
          onClick={() => setWhyOpen((o) => !o)}
          className={reportSkin.obsWhyToggle}
          aria-expanded={whyOpen}
        >
          <span>Neden böyle dedi?</span>
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform', whyOpen && 'rotate-180')}
          />
        </button>
        {whyOpen ? (
          <div className={reportSkin.obsWhyPanel}>
            <p className="text-sm text-stone-600">Bu gözlem şunlara dayanır:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-500">
              {observation.whyShownBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <button type="button" onClick={onScrollDetails} className={reportSkin.observationScrollHint}>
        <span>İsteğe bağlı detaylar</span>
        <ChevronDown className="h-4 w-4 opacity-60" strokeWidth={1.5} aria-hidden />
      </button>
    </section>
  );
}
