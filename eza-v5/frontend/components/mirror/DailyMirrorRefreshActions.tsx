'use client';

import type { ReactNode } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_CURRENT_BADGE,
  MIRROR_CURRENT_HINT,
  MIRROR_NEW_SCENE_HINT,
  MIRROR_NEW_SCENE_LABEL,
  MIRROR_SCENE_STYLE_PREFIX,
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

export type DailyMirrorRefreshActionsProps = {
  refreshCta: Exclude<MirrorRefreshCta, 'open_first'>;
  isPlus: boolean;
  /** Kart ready — Plus yeni sahne aksiyonu (yalnızca current + aynı veri). */
  cardReady?: boolean;
  sceneImageStatus?: MirrorSceneImageStatus;
  showShare?: boolean;
  onUpdate: () => void;
  onNewScene?: () => void;
  /** P4-C5 — aktif Style Lens (Plus, uygulama içi). */
  activeStyleLensLabel?: string;
  onShare?: () => void;
  freePlusHint?: string;
  children?: ReactNode;
  className?: string;
};

function PlusNewSceneBlock({
  sceneImageStatus = 'idle',
  onNewScene,
}: {
  sceneImageStatus: MirrorSceneImageStatus;
  onNewScene: () => void;
}) {
  const canRequest = canRequestNewSceneVariation(true, sceneImageStatus);
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
  showShare = false,
  onUpdate,
  onNewScene,
  activeStyleLensLabel,
  onShare,
  freePlusHint,
  children,
  className,
}: DailyMirrorRefreshActionsProps) {
  const showNewScene =
    isPlus && cardReady && refreshCta === 'current' && typeof onNewScene === 'function';

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
          <button type="button" onClick={onShare} className={ms.shareAction}>
            <Share2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
            {MIRROR_SHARE_LABEL}
          </button>
        ) : null}
        {showNewScene ? (
          <PlusNewSceneBlock sceneImageStatus={sceneImageStatus} onNewScene={onNewScene} />
        ) : null}
        {showNewScene && activeStyleLensLabel ? (
          <p className={cn(ms.sceneWrap, 'text-center text-[11px] font-medium text-violet-700/85')}>
            {MIRROR_SCENE_STYLE_PREFIX} {activeStyleLensLabel}
          </p>
        ) : null}
        {!isPlus && freePlusHint ? (
          <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>{freePlusHint}</p>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex w-full max-w-sm flex-col items-center gap-3', className)}>
      {isPlus && showShare && onShare ? (
        <button type="button" onClick={onShare} className={ms.shareAction}>
          <Share2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
          {MIRROR_SHARE_LABEL}
        </button>
      ) : null}
      <button type="button" onClick={onUpdate} className={actionBtnClass}>
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
