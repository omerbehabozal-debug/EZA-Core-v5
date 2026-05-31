'use client';

import { Lock, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_SCENE_GENERATE_BUTTON,
  MIRROR_SHARE_LABEL,
  PLAN_PLUS_FEATURE_HINT,
} from '@/lib/eza/mirror/copy';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const ms = standaloneSkin.mirrorSurface;

const lockedBtnClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-full border border-stone-200/60 bg-white/75 px-5 py-2.5 text-xs font-medium tracking-tight text-stone-600',
  'transition-colors hover:border-violet-200/50 hover:bg-white hover:text-stone-800',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50'
);

export type DailyMirrorPlusActionsProps = {
  onSceneUpgrade: () => void;
  onShareUpgrade: () => void;
  className?: string;
};

/** Free kullanıcı — tam kart sonrası sahne / paylaşım Plus yönlendirmesi (ikinci ayna kapısı yok). */
export default function DailyMirrorPlusActions({
  onSceneUpgrade,
  onShareUpgrade,
  className,
}: DailyMirrorPlusActionsProps) {
  return (
    <div className={cn('flex w-full max-w-sm flex-col items-center gap-3', className)}>
      <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
        {PLAN_PLUS_FEATURE_HINT}
      </p>
      <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={onSceneUpgrade} className={lockedBtnClass}>
          <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden />
          {MIRROR_SCENE_GENERATE_BUTTON}
        </button>
        <button type="button" onClick={onShareUpgrade} className={lockedBtnClass}>
          <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <Share2 className="h-3.5 w-3.5 opacity-60" aria-hidden />
          {MIRROR_SHARE_LABEL}
        </button>
      </div>
    </div>
  );
}
