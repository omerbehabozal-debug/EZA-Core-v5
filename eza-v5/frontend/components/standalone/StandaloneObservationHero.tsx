'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { USER_CATEGORY_LABEL } from '@/lib/eza/dailyObservation';
import { MIRROR_LABELS, STANDALONE_OBSERVATION_SUB } from '@/lib/eza/presentationTone';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const s = standaloneSkin.observationPolish;

interface StandaloneObservationHeroProps {
  observation: DailyObservationView;
  onScrollDetails: () => void;
  className?: string;
  personaSeed?: string;
}

function MirrorCard({
  label,
  text,
  pill,
}: {
  label: string;
  text: string;
  pill?: string;
}) {
  return (
    <article className={s.mirrorCard}>
      <p className={s.mirrorCardLabel}>{label}</p>
      {pill ? <span className={s.mirrorCardPill}>{pill}</span> : null}
      <p className={s.mirrorCardText}>{text}</p>
    </article>
  );
}

export default function StandaloneObservationHero({
  observation,
  onScrollDetails,
  className,
  personaSeed = 'standalone-persona',
}: StandaloneObservationHeroProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const mirror = MIRROR_LABELS.standalone;
  const persona = pickStandalonePersona(
    observation.personaFamilyId ?? observation.categoryId,
    personaSeed
  );

  const insight =
    observation.primaryInsight ||
    observation.manset ||
    'Son konuşmalarından henüz belirgin bir gözlem oluşmadı.';

  const userPill =
    observation.categoryId && USER_CATEGORY_LABEL[observation.categoryId]
      ? USER_CATEGORY_LABEL[observation.categoryId]
      : undefined;

  const flowLine =
    observation.yesterdayLine ||
    observation.fridaySummary ||
    observation.supportLine ||
    'Son etkileşimlerdeki konuşma ritmi bu gözleme temel oluşturdu.';

  const whyCards = [
    { title: 'Soru Yapın', body: observation.userLine },
    { title: 'AI Yanıt Davranışı', body: observation.aiLine },
    { title: 'Etkileşim Akışı', body: flowLine },
    { title: 'Denge Göstergesi', body: observation.balanceLine },
  ];

  return (
    <section
      className={cn(s.section, className)}
      aria-label="Bugün AI ile ilişkin nasıl?"
    >
      <div className={s.ambient} aria-hidden />

      <header>
        <h2 className={s.headerTitle}>Bugün AI ile ilişkin nasıl?</h2>
        <p className={s.headerSub}>{STANDALONE_OBSERVATION_SUB}</p>
      </header>

      {observation.priorityAlert?.show ? (
        <div className={s.priorityBlock} role="alert">
          <p className={s.priorityEyebrow}>Öncelikli gözlem</p>
          <p className={s.priorityHeadline}>{observation.priorityAlert.headline}</p>
          <p className={s.priorityMeta}>{observation.priorityAlert.interactionHint}</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/80">
            {observation.priorityAlert.detail}
          </p>
        </div>
      ) : null}

      <div className={s.mainCard}>
        <div className={s.mainCardInner}>
          <aside className={s.personaAside}>
            <div className={s.personaOrb} aria-hidden>
              {persona.emoji}
            </div>
            <p className={s.personaFamily}>{persona.familyLabel}</p>
          </aside>

          <div className={s.insightCol}>
            {observation.priorityAlert?.show ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  Genel akış özeti
                </p>
                <blockquote className={s.mainInsightSecondary}>{insight}</blockquote>
              </>
            ) : (
              <blockquote className={s.mainInsight}>{insight}</blockquote>
            )}

            <div className={s.personaChipSmall}>
              <span className={s.personaChipSmallEmoji} aria-hidden>
                {persona.emoji}
              </span>
              <span className={s.personaChipSmallLabel}>{persona.name}</span>
            </div>

            {!observation.priorityAlert?.show && observation.supportLine ? (
              <p className={s.supportLine}>{observation.supportLine}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className={s.mirrorGrid}>
        <MirrorCard label={mirror.user.toUpperCase()} text={observation.userLine} pill={userPill} />
        <MirrorCard label={mirror.ai.toUpperCase()} text={observation.aiLine} />
        <MirrorCard label={mirror.balance.toUpperCase()} text={observation.balanceLine} />
      </div>

      <div className={s.metricsRow}>
        <div className={s.metricsPills}>
          {observation.signalLevel ? (
            <span className={s.metricPill}>{observation.signalLevel}</span>
          ) : null}
          {observation.confidenceLabel ? (
            <span className={s.metricPill}>{observation.confidenceLabel}</span>
          ) : null}
        </div>

        {observation.showWeekPattern && observation.weekPattern.length > 0 ? (
          <div>
            <p className={s.patternCaption}>Son etkileşimler</p>
            <div className={s.patternDots} role="list" aria-label="Son etkileşim desenleri">
              {observation.weekPattern.map((dot, index) => (
                <span
                  key={`${dot.hoverTitle}-${index}`}
                  role="listitem"
                  className={cn(s.patternDot, dot.isLatest && s.patternDotLatest)}
                  title={dot.hoverTitle}
                >
                  <span aria-hidden>{dot.emoji}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {observation.yesterdayLine && !observation.priorityAlert?.show ? (
          <p className={s.contextLine}>{observation.yesterdayLine}</p>
        ) : null}
        {observation.fridaySummary ? (
          <p className={s.contextLine}>{observation.fridaySummary}</p>
        ) : null}
      </div>

      <div className={s.whyWrap}>
        <button
          type="button"
          onClick={() => setWhyOpen((o) => !o)}
          className={s.whyToggle}
          aria-expanded={whyOpen}
        >
          <span>Neden böyle dedi?</span>
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform', whyOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {whyOpen ? (
          <div className={s.whyGrid}>
            {whyCards.map((card) => (
              <article key={card.title} className={s.whyCard}>
                <p className={s.whyCardTitle}>{card.title}</p>
                <p className={s.whyCardBody}>{card.body}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" onClick={onScrollDetails} className={s.scrollHint}>
        <span>İsteğe bağlı detaylar</span>
        <ChevronDown className="h-4 w-4 opacity-60" strokeWidth={1.5} aria-hidden />
      </button>
    </section>
  );
}