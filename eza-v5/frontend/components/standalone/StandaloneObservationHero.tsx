'use client';

import { Fragment, useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  Activity,
  Bot,
  ChevronDown,
  Heart,
  Info,
  MessageCircle,
  Quote,
  Shield,
  Sparkles,
  User,
  Waypoints,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { USER_CATEGORY_LABEL } from '@/lib/eza/dailyObservation';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import PersonaVisual from '@/components/standalone/PersonaVisual';
const s = standaloneSkin.observationPolish;
const mot = standaloneSkin.motion;

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

/** Vurgulanacak kelimeler — mockup’taki mor accent */
function InsightText({
  text,
  highlights,
  className,
}: {
  text: string;
  highlights: string[];
  className?: string;
}) {
  if (text.includes('**')) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p className={className}>
        {parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <span key={i} className={s.insightAccent}>
              {part.slice(2, -2)}
            </span>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          )
        )}
      </p>
    );
  }

  const terms = highlights
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) {
    return <p className={className}>{text}</p>;
  }

  let bestIdx = -1;
  let bestLen = 0;
  for (const term of terms) {
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = term.length;
    }
  }

  if (bestIdx < 0) {
    return <p className={className}>{text}</p>;
  }

  const before = text.slice(0, bestIdx);
  const accent = text.slice(bestIdx, bestIdx + bestLen);
  const after = text.slice(bestIdx + bestLen);

  return (
    <p className={className}>
      {before}
      <span className={s.insightAccent}>{accent}</span>
      {after}
    </p>
  );
}

function MirrorCard({
  label,
  text,
  pills,
  footer,
  icon,
  iconWrapClass,
  animClass,
  compact = false,
}: {
  label: string;
  text: string;
  pills: string[];
  footer: string;
  icon: React.ReactNode;
  iconWrapClass: string;
  animClass: string;
  compact?: boolean;
}) {
  return (
    <article className={cn(compact ? s.mirrorCardCompact : s.mirrorCard, animClass)}>
      <div className="flex items-start gap-3">
        <div className={iconWrapClass}>{icon}</div>
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
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
  const reducedMotion = useReducedMotion();
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

  const userPills = [
    userPill ?? 'Etkileşim tonu',
    observation.signalLevel || 'Gözlem',
  ].slice(0, 2);

  const aiPills = [
    'Yanıt tonu',
    observation.confidenceLabel?.includes('yüksek') || observation.confidenceLabel?.includes('Yüksek')
      ? 'Yapılandırıcı'
      : 'Açıklayıcı',
  ].slice(0, 2);

  const balancePills = ['Uyumlu akış', observation.signalLevel || 'Dengeli'].slice(0, 2);

  const insightHighlights = [userPill, persona.familyLabel, persona.name].filter(
    Boolean
  ) as string[];

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

  const weekDots = useMemo(() => {
    const src = observation.showWeekPattern ? observation.weekPattern.slice(0, 7) : [];
    const out: Array<(typeof src)[0] | null> = [...src];
    while (out.length < 7) out.push(null);
    return out;
  }, [observation.showWeekPattern, observation.weekPattern]);

  const anim = (cls: string) => (!reducedMotion ? cls : '');

  const trustFooter = observation.confidenceLabel
    ? `Güven: ${observation.confidenceLabel}`
    : 'Güven: İzleniyor';

  return (
    <section className={cn(s.section, 'relative', className)} aria-label="Bugünkü gözlem">
      <div className={s.ambient} aria-hidden />

      <article className={cn(s.mainCard, anim(mot.fadeIn1))}>
        {observation.priorityAlert?.show ? (
          <div className={cn(s.priorityBand, 'mb-5')} role="alert">
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
          <div className={s.heroPersonaCol}>
            <span className={s.energyBadge}>Bugünkü enerjin</span>

            <aside className={s.personaAside}>
              <div className={s.personaGlow}>
                <div className={s.personaGlowRing} aria-hidden />
                <PersonaVisual persona={persona} variant="hero" size="hero" />
              </div>
            </aside>

            <div className={s.insightCol}>
              {observation.priorityAlert?.show ? (
                <InsightText
                  text={insight}
                  highlights={insightHighlights}
                  className={s.mainInsightSecondary}
                />
              ) : (
                <InsightText
                  text={insight}
                  highlights={insightHighlights}
                  className={s.mainInsight}
                />
              )}
            </div>

            <div className={s.personaChip}>
              <span className={s.personaChipEmoji} aria-hidden>
                {persona.iconFallback || persona.emoji}
              </span>
              <span className={s.personaChipLabel}>{persona.name}</span>
            </div>
          </div>

          <div className={s.heroMirrorCol}>
            <MirrorCard
              compact
              label="SEN"
              text={observation.userLine}
              pills={userPills}
              footer={trustFooter}
              icon={<User className="h-4 w-4" strokeWidth={1.75} />}
              iconWrapClass={s.mirrorIconWrap}
              animClass={anim(mot.fadeIn2)}
            />
            <MirrorCard
              compact
              label="AI"
              text={observation.aiLine}
              pills={aiPills}
              footer="Yanıt tonu: Dengeli"
              icon={<Bot className="h-4 w-4" strokeWidth={1.75} />}
              iconWrapClass={s.mirrorIconWrapAi}
              animClass={anim(mot.fadeIn3)}
            />
            <MirrorCard
              compact
              label="DENGE"
              text={observation.balanceLine}
              pills={balancePills}
              footer="Denge: İyi"
              icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
              iconWrapClass={s.mirrorIconWrapBalance}
              animClass={anim(mot.fadeIn4)}
            />
          </div>
        </div>
      </article>

      <div className={cn(s.metricsGrid, anim(mot.fadeIn4))}>
        {observation.signalLevel ? (
          <article className={s.metricCard}>
            <Activity className={cn('h-4 w-4', s.metricCardIcon)} aria-hidden />
            <p className={cn(s.metricCardLabel, 'mt-2 uppercase')}>Sinyal seviyesi</p>
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
            <p className={cn(s.metricCardLabel, 'mt-2 uppercase')}>Güven seviyesi</p>
            <p className={s.metricCardValue}>{observation.confidenceLabel}</p>
            <div className={s.metricProgressTrack}>
              <div
                className={s.metricProgressFillTrust}
                style={{ width: `${confidenceProgress(observation.confidenceLabel)}%` }}
              />
            </div>
          </article>
        ) : null}
        <article className={s.metricCard}>
          <Activity className={cn('h-4 w-4', s.metricCardIcon)} aria-hidden />
          <p className={cn(s.metricCardLabel, 'mt-2 uppercase')}>Son 7 etkileşim</p>
          <div className={cn(s.patternDots, 'mt-4')} role="list" aria-label="Son etkileşim desenleri">
            {weekDots.map((dot, index) => (
              <span
                key={dot ? `${dot.hoverTitle}-${index}` : `empty-${index}`}
                role="listitem"
                className={cn(
                  s.patternDot,
                  !dot && s.patternDotInactive,
                  dot?.isLatest && s.patternDotLatest
                )}
                title={dot?.hoverTitle}
              >
                {dot ? <span className="sr-only">{dot.emoji}</span> : null}
              </span>
            ))}
          </div>
        </article>
      </div>

      <div className={s.lowerGrid}>
        <div className={s.whyWrap}>
          <button
            type="button"
            onClick={() => setWhyOpen((o) => !o)}
            className={s.whyToggle}
            aria-expanded={whyOpen}
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-violet-500/80" aria-hidden />
              Neden böyle dedi?
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-stone-400 transition-transform', whyOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {whyOpen ? (
            <div className={cn(s.whyGrid, 'mt-4')}>
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
          <div className={s.inspirationHills} aria-hidden>
            <div className={s.inspirationHillShape} />
            <div className={s.inspirationHillShape2} />
          </div>
          <Quote className="relative z-10 mb-4 h-6 w-6 text-violet-600/45" aria-hidden />
          <p className={s.inspirationQuote}>
            Her gün yeni bir sen,
            <br />
            yeni bir etkileşim.
            <br />
            Yarın EZA&apos;nın ne gözlemleyeceğini
            <br />
            merak et! ✨
          </p>
        </aside>
      </div>

      <button type="button" onClick={onScrollDetails} className={cn(s.scrollHint, 'sr-only')}>
        İsteğe bağlı detaylar
      </button>

    </section>
  );
}
