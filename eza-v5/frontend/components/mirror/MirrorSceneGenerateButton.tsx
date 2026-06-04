'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_SCENE_GENERATE_BUTTON,
  MIRROR_SCENE_GENERATING,
  MIRROR_SCENE_RETRY,
} from '@/lib/eza/mirror/copy';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

export type MirrorSceneGenerateButtonProps = {
  status: MirrorSceneImageStatus;
  onGenerate: () => void;
  disabled?: boolean;
  className?: string;
};

const ms = standaloneSkin.mirrorSurface;

const btnClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-full border border-stone-200/50 bg-white/80 px-5 py-2 text-xs font-medium tracking-tight text-stone-600 transition-colors',
  'hover:border-violet-200/40 hover:bg-white hover:text-stone-800',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

export default function MirrorSceneGenerateButton({
  status,
  onGenerate,
  disabled = false,
  className,
}: MirrorSceneGenerateButtonProps) {
  const isGenerating = status === 'generating';
  const isError = status === 'error';

  if (status === 'ready') {
    return null;
  }

  const label = isError
    ? MIRROR_SCENE_RETRY
    : isGenerating
      ? MIRROR_SCENE_GENERATING
      : MIRROR_SCENE_GENERATE_BUTTON;

  return (
    <div className={cn(ms.sceneWrap, 'gap-2', className)}>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        className={btnClass}
        aria-busy={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : null}
        {label}
      </button>
    </div>
  );
}
