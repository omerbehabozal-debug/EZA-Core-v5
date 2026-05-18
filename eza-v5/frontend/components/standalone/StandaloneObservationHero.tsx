'use client';

import { useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ChevronDown, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { USER_CATEGORY_LABEL } from '@/lib/eza/dailyObservation';
import { MIRROR_LABELS, STANDALONE_OBSERVATION_SUB } from '@/lib/eza/presentationTone';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { buildObservationSharePayload } from '@/lib/eza/standaloneShare';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import PersonaVisual from '@/components/standalone/PersonaVisual';
import StandaloneShareModal from '@/components/standalone/StandaloneShareModal';

const s = standaloneSkin.observationPolish;
const mot = standaloneSkin.motion;
const sh = standaloneSkin.share;

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
  animClass,
}: {
  label: string;
  text: string;
  pill?: string;
  animClass: string;
}) {
  return (
    <article className={cn(s.mirrorCard, animClass)}>
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
  const [shareOpen, setShareOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const mirror = MIRROR_LABELS.standalone;
  const persona = pickStandalonePersona(
    observation.personaFamilyId ?? observation.categoryId,
    personaSeed
  );

  const sharePayload = useMemo(
    () => buildObservationSharePayload(observation, persona),
    [observation, persona]
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

  const anim = (cls: string) => (!reducedMotion ? cls : '');

  return (
    <section
      className={cn(s.section, className)}
      aria-label="Bugün AI ile ilişkin nasıl?"
    >
      <div className={s.ambient} aria-hidden />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={s.headerTitle}>Bugün AI ile ilişkin nasıl?</h2>
          <p className={s.headerSub}>{STANDALONE_OBSERVATION_SUB}</p>
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

      {observation.priorityAlert?.show ? (
        <div className={cn(s.priorityBlock, anim(mot.fadeIn))} role="alert">
          <p className={s.priorityEyebrow}>Öncelikli gözlem</p>
          <p className={s.priorityHeadline}>{observation.priorityAlert.headline}</p>
          <p className={s.priorityMeta}>{observation.priorityAlert.interactionHint}</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/80">
            {observation.priorityAlert.detail}
          </p>
        </div>
      ) : null}

      <div className={cn(s.mainCard, anim(mot.fadeIn1))}>
        <div className={s.mainCardInner}>
          <aside className={s.personaAside}>
            <PersonaVisual persona={persona} size="md" />
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
                {persona.iconFallback || persona.emoji}
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
        <MirrorCard
          label={mirror.user.toUpperCase()}
          text={observation.userLine}
          pill={userPill}
          animClass={anim(mot.fadeIn2)}
        />
        <MirrorCard
          label={mirror.ai.toUpperCase()}
          text={observation.aiLine}
          animClass={anim(mot.fadeIn3)}
        />
        <MirrorCard
          label={mirror.balance.toUpperCase()}
          text={observation.balanceLine}
          animClass={anim(mot.fadeIn4)}
        />
      </div>

      <div className={cn(s.metricsRow, anim(mot.fadeIn4))}>
        <div className={s.metricsPills}>
          {observation.signalLevel ? (
            <span className={cn(s.metricPill, anim(mot.fadeIn2))}>{observation.signalLevel}</span>
          ) : null}
          {observation.confidenceLabel ? (
            <span className={cn(s.metricPill, anim(mot.fadeIn3))}>
              {observation.confidenceLabel}
            </span>
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

      <StandaloneShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareTitle={sharePayload.title}
        clipboardText={sharePayload.clipboardText}
      >
        <div className={sh.card}>
          <p className={sh.cardLogo}>EZA</p>
          <p className="mt-1 text-xs text-stone-500">{sharePayload.personaLabel}</p>
          <p className={sh.cardInsight}>{sharePayload.insight}</p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.user}: </span>
            {sharePayload.userLine}
          </p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.ai}: </span>
            {sharePayload.aiLine}
          </p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.balance}: </span>
            {sharePayload.balanceLine}
          </p>
          <p className={sh.cardWatermark}>eza.global</p>
        </div>
      </StandaloneShareModal>
    </section>
  );
}
