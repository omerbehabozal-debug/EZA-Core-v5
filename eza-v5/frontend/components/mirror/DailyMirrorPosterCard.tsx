'use client';

import { useMemo } from 'react';
import { Calendar, Sparkles, User, Bot, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  POSTER_ASPECT_RATIO,
  POSTER_CARD_WIDTH_PX,
  posterCardSkin as s,
} from '@/lib/eza/mirror/posterCardSkin';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';
import MirrorVisualPromptDebug from '@/components/mirror/MirrorVisualPromptDebug';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

const RELATION_ICONS = {
  Sen: User,
  AI: Bot,
  Denge: Scale,
} as const;

function RelationBlock({
  label,
  line,
  percent,
}: {
  label: string;
  line: string;
  percent: number;
}) {
  const Icon = RELATION_ICONS[label as keyof typeof RELATION_ICONS] ?? User;
  return (
    <div className={s.relationCell}>
      <p className={s.relationLabel}>
        <Icon className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </p>
      <p className={s.relationLine}>{line}</p>
      <div className={s.relationBar} aria-hidden>
        <div className={s.relationBarFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function DailyMirrorPosterCard({
  card,
  meta,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorPosterCardProps) {
  const isReady =
    Boolean(meta?.hasEnoughData) && card.shareEnabled && Boolean(card.characterName);
  const isSparse = !isReady;
  const content = useMemo(() => buildPosterCardContent(card), [card]);

  const sen = content.activities.find((a) => a.label === 'Sen');
  const ai = content.activities.find((a) => a.label === 'AI');
  const balance = content.activities.find((a) => a.label === 'Denge');
  const bars = content.relationshipBars;

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      className={cn(s.root, 'flex flex-col')}
      style={{
        aspectRatio: POSTER_ASPECT_RATIO,
        maxWidth: POSTER_CARD_WIDTH_PX,
        width: '100%',
      }}
      aria-labelledby="daily-mirror-poster-title"
    >
      <div className={cn(s.grain, 'z-[3]')} aria-hidden />
      <div className={cn(s.vignette, 'z-[3]')} aria-hidden />

      <div className={s.sceneZone}>
        <DailyMirrorPosterScene
          personaFamilyId={card.personaFamilyId}
          sceneImageUrl={card.visual?.sceneImageUrl}
          sceneImageStatus={card.visual?.sceneImageStatus}
          onSceneImageLoad={onSceneImageLoad}
          onSceneImageError={onSceneImageError}
        />

        <header className={s.header}>
          <div className="space-y-0.5">
            <p className={cn(s.logoText, 'flex items-center gap-2')}>
              <span className={s.logoMark}>
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              EZA
            </p>
            <p className={s.logoSub}>AI İlişki Aynası</p>
          </div>
          <div className={s.datePill}>
            <Calendar className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{card.dayLabel}</span>
          </div>
        </header>

        <div className={s.heroBlock}>
          <p className={s.heroEyebrow}>Bugünkü AI İlişki Aynan</p>
          <h2
            id="daily-mirror-poster-title"
            className={cn(
              s.heroTitle,
              'bg-gradient-to-r bg-clip-text text-transparent',
              content.characterGradient
            )}
          >
            {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
          </h2>
        </div>
      </div>

      <div className={s.bodyPanel}>
        <p className={s.story}>{isSparse ? MIRROR_INSUFFICIENT : content.storyLine}</p>

        {!isSparse ? (
          <>
            <div className={s.themeBox}>
              <p className={s.themeLabel}>
                <span aria-hidden>{content.characterEmoji}</span>
                <span className="ml-1">Tema</span>
              </p>
              <p className={s.themeTitle}>{content.themeTitle}</p>
              <p className={s.themeDesc}>{content.themeDescription}</p>
            </div>

            <div className={s.quoteBand}>
              <p className={s.quoteText}>{content.quote}</p>
            </div>

            <div className={s.relationGrid}>
              <RelationBlock
                label="Sen"
                line={sen?.value ?? '—'}
                percent={bars[0]?.percent ?? content.energyPercent}
              />
              <RelationBlock
                label="AI"
                line={ai?.value ?? '—'}
                percent={bars[1]?.percent ?? Math.min(95, content.energyPercent + 4)}
              />
              <RelationBlock
                label="Denge"
                line={balance?.value ?? '—'}
                percent={bars[2]?.percent ?? Math.max(30, content.energyPercent - 8)}
              />
            </div>
          </>
        ) : null}

        <footer className={s.footer}>
          <span className="font-semibold text-violet-700/80">EZA</span>
          <span>#EZAİlişkiAynası</span>
          <span className="text-violet-400/90">eza.ai</span>
        </footer>

        <MirrorVisualPromptDebug visual={card.visual} />
      </div>
    </article>
  );
}
