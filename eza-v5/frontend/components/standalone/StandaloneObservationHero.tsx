'use client';

import { useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  Activity,
  Bot,
  ChevronDown,
  Heart,
  MessageCircle,
  Quote,
  Share2,
  Shield,
  Sparkles,
  User,
  Waypoints,
} from 'lucide-react';
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

function signalProgress(level: string): number {
  const l = level.toLowerCase();
  if (l.includes('yüksek') || l.includes('high')) return 78;
  if (l.includes('orta') || l.includes('medium')) return 52;
  if (l.includes('düşük') || l.includes('low')) return 28;
  return 45;
}

function confidenceProgress(label: string): number {
  const l = label.toLowerCase();
  if (l.includes('yüksek') || l.includes('high')) return 85;
  if (l.includes('orta') || l.includes('medium')) return 55;
  return 40;
}

function MirrorCard({
  label,
  text,
  pills,
  footer,
  icon,
  iconWrapClass,
  animClass,
}: {
  label: string;
  text: string;
  pills: string[];
  footer: string;
  icon: React.ReactNode;
  iconWrapClass: string;
  animClass: string;
}) {
  return (
    <article className={cn(s.mirrorCard, animClass)}>
      <div className={iconWrapClass}>{icon}</div>
      <p className={s.mirrorCardLabel}>{label}</p>
      <div className={s.mirrorPillRow}>
        {pills.map((pill) => (
          <span key={pill} className={s.mirrorCardPill}>
            {pill}
          </span>
        ))}
      </div>
      <p className={s.mirrorCardText}>{text}</p>
      <p className={s.mirrorFooter}>
        <span className={s.mirrorFooterDot} aria-hidden />
        {footer}
      </p>
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

  const userPills = [
    userPill ?? 'Etkileşim tonu',
    observation.signalLevel || 'Gözlem',
  ].slice(0, 2);

  const aiPills = [
    observation.confidenceLabel ? 'Yanıt tonu' : 'AI yanıtı',
    observation.confidenceLabel || 'Dengeli',
  ].slice(0, 2);

  const balancePills = ['Etkileşim akışı', observation.signalLevel || 'Denge'].slice(0, 2);

  const whyCards = [
    {
      title: 'Soru Yapın',
      body: observation.userLine,
      icon: <MessageCircle className="h-5 w-5" strokeWidth={1.5} />,
    },
    {
      title: 'AI Yanıt Davranışı',
      body: observation.aiLine,
      icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
    },
    {
      title: 'Etkileşim Akışı',
      body: flowLine,
      icon: <Waypoints className="h-5 w-5" strokeWidth={1.5} />,
    },
    {
      title: 'Denge Göstergesi',
      body: observation.balanceLine,
      icon: <Heart className="h-5 w-5" strokeWidth={1.5} />,
    },
  ];

  const anim = (cls: string) => (!reducedMotion ? cls : '');

  return (
    <section
      className={cn(s.section, className)}
      aria-label="Bugün AI ile ilişkin nasıl?"
    >
      <div className={s.ambient} aria-hidden />

      <header className={s.headerRow}>
        <div>
          <h2 className={s.headerTitle}>Bugün AI ile ilişkin nasıl?</h2>
          <p className={s.headerSub}>{STANDALONE_OBSERVATION_SUB}</p>
        </div>
        <button type="button" onClick={() => setShareOpen(true)} className={sh.triggerBtn}>
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Paylaş
        </button>
      </header>

      <div className={cn(s.mainCard, anim(mot.fadeIn1))}>
        {observation.priorityAlert?.show ? (
          <div className={cn(s.priorityBand, 'mb-6')} role="alert">
            <p className={s.priorityEyebrow}>Öncelikli not</p>
            <p className={s.priorityHeadline}>
              {observation.priorityAlert.headline ||
                'Son konuşmada dikkat gerektiren bir giriş sinyali gözlemlendi.'}
            </p>
            <p className={s.priorityMeta}>
              {observation.priorityAlert.interactionHint ||
                'Bu yalnızca son etkileşime ait gözlemsel bir nottur.'}
            </p>
          </div>
        ) : null}

        <div className={s.mainCardInner}>
          <aside className={s.personaAside}>
            <div className={s.personaGlow}>
              <div className={s.personaGlowRing} aria-hidden />
              <PersonaVisual persona={persona} variant="hero" size="hero" />
            </div>
            <div className={s.personaChip}>
              <span className={s.personaChipEmoji} aria-hidden>
                {persona.iconFallback || persona.emoji}
              </span>
              <span className={s.personaChipLabel}>{persona.name}</span>
            </div>
            <p className={s.personaFamily}>{persona.familyLabel}</p>
          </aside>

          <div className={s.insightCol}>
            <p className={s.insightEyebrow}>Bugünkü gözlem</p>
            {observation.priorityAlert?.show ? (
              <blockquote className={s.mainInsightSecondary}>{insight}</blockquote>
            ) : (
              <blockquote className={s.mainInsight}>{insight}</blockquote>
            )}
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
          pills={userPills}
          footer={`Güven: ${observation.confidenceLabel || 'İzleniyor'}`}
          icon={<User className="h-5 w-5" strokeWidth={1.5} />}
          iconWrapClass={s.mirrorIconWrap}
          animClass={anim(mot.fadeIn2)}
        />
        <MirrorCard
          label={mirror.ai.toUpperCase()}
          text={observation.aiLine}
          pills={aiPills}
          footer="Yanıt tonu: Dengeli"
          icon={<Bot className="h-5 w-5" strokeWidth={1.5} />}
          iconWrapClass={s.mirrorIconWrapAi}
          animClass={anim(mot.fadeIn3)}
        />
        <MirrorCard
          label={mirror.balance.toUpperCase()}
          text={observation.balanceLine}
          pills={balancePills}
          footer="Denge: Stabil"
          icon={<Heart className="h-5 w-5" strokeWidth={1.5} />}
          iconWrapClass={s.mirrorIconWrapBalance}
          animClass={anim(mot.fadeIn4)}
        />
      </div>

      <div className={cn(s.metricsGrid, anim(mot.fadeIn4))}>
        {observation.signalLevel ? (
          <article className={s.metricCard}>
            <Activity className={cn('h-4 w-4', s.metricCardIcon)} aria-hidden />
            <p className={cn(s.metricCardLabel, 'mt-3')}>Sinyal seviyesi</p>
            <p className={s.metricCardValue}>{observation.signalLevel}</p>
            <div className={s.metricProgressTrack}>
              <div
                className={s.metricProgressFill}
                style={{ width: `${signalProgress(observation.signalLevel)}%` }}
              />
            </div>
          </article>
        ) : null}
        {observation.confidenceLabel ? (
          <article className={s.metricCard}>
            <Shield className={cn('h-4 w-4', s.metricCardIcon)} aria-hidden />
            <p className={cn(s.metricCardLabel, 'mt-3')}>Güven seviyesi</p>
            <p className={s.metricCardValue}>{observation.confidenceLabel}</p>
            <div className={s.metricProgressTrack}>
              <div
                className={s.metricProgressFill}
                style={{ width: `${confidenceProgress(observation.confidenceLabel)}%` }}
              />
            </div>
          </article>
        ) : null}
        {observation.showWeekPattern && observation.weekPattern.length > 0 ? (
          <article className={s.metricCard}>
            <Activity className={cn('h-4 w-4', s.metricCardIcon)} aria-hidden />
            <p className={cn(s.metricCardLabel, 'mt-3')}>Son 7 etkileşim</p>
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
          </article>
        ) : null}
      </div>

      {(observation.yesterdayLine || observation.fridaySummary) && !observation.priorityAlert?.show ? (
        <p className={s.contextLine}>
          {observation.yesterdayLine ?? observation.fridaySummary}
        </p>
      ) : null}

      <div className={s.lowerGrid}>
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
                  <div className={s.whyIconWrap}>{card.icon}</div>
                  <p className={s.whyCardTitle}>{card.title}</p>
                  <p className={s.whyCardBody}>{card.body}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <aside className={cn(s.inspirationCard, anim(mot.fadeIn3))}>
          <div className={s.inspirationDecor} aria-hidden />
          <Quote className="mb-3 h-5 w-5 text-violet-600/50" aria-hidden />
          <p className={s.inspirationQuote}>
            Her gün yeni bir sen, yeni bir etkileşim. Yarın EZA&apos;nın ne gözlemleyeceğini merak
            et.
          </p>
        </aside>
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
