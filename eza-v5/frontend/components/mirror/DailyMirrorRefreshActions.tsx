'use client';

import type { ReactNode } from 'react';
import { Loader2, Share2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_CURRENT_BADGE,
  MIRROR_CURRENT_HINT,
  MIRROR_NEW_SCENE_HINT,
  MIRROR_NEW_SCENE_LABEL,
  MIRROR_SCENE_GENERATING,
  MIRROR_SHARE_LABEL,
  MIRROR_UPDATE_LABEL,
  MIRROR_UPDATE_SIGNAL_HINT,
} from '@/lib/eza/mirror/copy';
import type { MirrorRefreshCta } from '@/lib/eza/mirror/dailyMirrorSnapshot';
import { canRequestNewSceneVariation } from '@/lib/eza/mirror/mirrorSceneVariation';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const ms = standaloneSkin.mirrorSurface;

const actionBtnClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-full border border-stone-200/50 bg-white/80 px-5 py-2 text-xs font-medium tracking-tight text-stone-600',
  'transition-colors hover:border-violet-200/40 hover:bg-white hover:text-stone-800',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const primaryShareClass = cn(
  'inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-violet-200/55 bg-violet-600 px-5 py-2.5 text-xs font-medium tracking-tight text-white shadow-sm',
  'transition-colors hover:bg-violet-700',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

export type DailyMirrorRefreshActionsProps = {
  refreshCta: Exclude<MirrorRefreshCta, 'open_first'>;
  isPlus: boolean;
  cardReady?: boolean;
  sceneImageStatus?: MirrorSceneImageStatus;
  hasProductionQuota?: boolean;
  showShare?: boolean;
  onUpdate: () => void;
  onNewScene?: () => void;
  /** @deprecated Style Lens label retired — ignored. */
  activeStyleLensLabel?: string;
  onShare?: () => void;
  freePlusHint?: string;
  /** Poster-visible ready state — icon-only action row, no badge or hint copy. */
  minimal?: boolean;
  children?: ReactNode;
  className?: string;
};

function PlusNewSceneBlock({
  sceneImageStatus = 'idle',
  hasProductionQuota = true,
  onNewScene,
}: {
  sceneImageStatus: MirrorSceneImageStatus;
  hasProductionQuota?: boolean;
  onNewScene: () => void;
}) {
  const canRequest = canRequestNewSceneVariation(true, sceneImageStatus, hasProductionQuota);
  const isGenerating = sceneImageStatus === 'generating';

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={onNewScene}
        disabled={!canRequest}
        className={actionBtnClass}
        aria-busy={isGenerating}
      >
        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {isGenerating ? MIRROR_SCENE_GENERATING : MIRROR_NEW_SCENE_LABEL}
      </button>
      <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
        {MIRROR_NEW_SCENE_HINT}
      </p>
    </div>
  );
}

export default function DailyMirrorRefreshActions({
  refreshCta,
  isPlus,
  cardReady = false,
  sceneImageStatus = 'idle',
  hasProductionQuota = true,
  showShare = false,
  onUpdate,
  onNewScene,
  onShare,
  freePlusHint,
  minimal = false,
  children,
  className,
}: DailyMirrorRefreshActionsProps) {
  const showNewScene =
    isPlus && cardReady && refreshCta === 'current' && typeof onNewScene === 'function';

  if (refreshCta === 'current' && minimal) {
    const hasActions = showShare || showNewScene;
    if (!hasActions) return null;

    const isGenerating = sceneImageStatus === 'generating';

    return (
      <div className={cn(ms.mirrorActionRow, className)} role="toolbar" aria-label="Ayna işlemleri">
        {showShare && onShare ? (
          <button
            type="button"
            onClick={onShare}
            className={ms.mirrorIconBtn}
            aria-label={MIRROR_SHARE_LABEL}
            title={MIRROR_SHARE_LABEL}
          >
            <Share2 className="h-4 w-4 opacity-90" aria-hidden />
          </button>
        ) : null}
        {showNewScene && onNewScene ? (
          <button
            type="button"
            onClick={onNewScene}
            disabled={!canRequestNewSceneVariation(true, sceneImageStatus, hasProductionQuota)}
            className={ms.mirrorIconBtn}
            aria-label={isGenerating ? MIRROR_SCENE_GENERATING : MIRROR_NEW_SCENE_LABEL}
            title={isGenerating ? MIRROR_SCENE_GENERATING : MIRROR_NEW_SCENE_LABEL}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 opacity-80" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    );
  }

  if (refreshCta === 'current') {
    return (
      <div className={cn('flex w-full max-w-sm flex-col items-center gap-3', className)}>
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800/90'
          )}
          role="status"
        >
          {MIRROR_CURRENT_BADGE}
        </span>
        <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
          {MIRROR_CURRENT_HINT}
        </p>
        {showShare && onShare ? (
          <button type="button" onClick={onShare} className={primaryShareClass}>
            <Share2 className="h-4 w-4 opacity-90" aria-hidden />
            {MIRROR_SHARE_LABEL}
          </button>
        ) : null}
        {showNewScene && onNewScene ? (
          <PlusNewSceneBlock
            sceneImageStatus={sceneImageStatus}
            hasProductionQuota={hasProductionQuota}
            onNewScene={onNewScene}
          />
        ) : null}
        {!isPlus && freePlusHint ? (
          <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>{freePlusHint}</p>
        ) : null}
        {children}
      </div>
    );
  }

  const updateDisabled = isPlus && !hasProductionQuota;

  return (
    <div className={cn('flex w-full max-w-sm flex-col items-center gap-3', className)}>
      {isPlus && showShare && onShare ? (
        <button type="button" onClick={onShare} className={primaryShareClass}>
          <Share2 className="h-4 w-4 opacity-90" aria-hidden />
          {MIRROR_SHARE_LABEL}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onUpdate}
        disabled={updateDisabled}
        className={actionBtnClass}
      >
        {MIRROR_UPDATE_LABEL}
      </button>
      <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
        {MIRROR_UPDATE_SIGNAL_HINT}
      </p>
      {!isPlus && freePlusHint ? (
        <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>{freePlusHint}</p>
      ) : null}
      {children}
    </div>
  );
}
