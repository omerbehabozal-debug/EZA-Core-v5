'use client';

import { Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_SCENE_ERROR,
  MIRROR_SCENE_GENERATE_BUTTON,
  MIRROR_SCENE_GENERATING,
} from '@/lib/eza/mirror/copy';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

export type MirrorSceneGenerateButtonProps = {
  status: MirrorSceneImageStatus;
  onGenerate: () => void;
  disabled?: boolean;
  className?: string;
};

export default function MirrorSceneGenerateButton({
  status,
  onGenerate,
  disabled = false,
  className,
}: MirrorSceneGenerateButtonProps) {
  const isGenerating = status === 'generating';
  const isReady = status === 'ready';
  const isError = status === 'error';

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || isGenerating || isReady}
        className={cn(
          'inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-violet-200/90 bg-white/90 px-5 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-colors',
          'hover:border-violet-300 hover:bg-violet-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {MIRROR_SCENE_GENERATING}
          </>
        ) : (
          <>
            <ImageIcon className="h-4 w-4" aria-hidden />
            {MIRROR_SCENE_GENERATE_BUTTON}
          </>
        )}
      </button>
      {isError ? (
        <p className="text-center text-sm text-stone-500" role="status">
          {MIRROR_SCENE_ERROR}
        </p>
      ) : null}
      {isReady ? (
        <p className="text-center text-xs text-stone-500" role="status">
          Sahne görseli hazır. Paylaşım kartındaki görseli de içerir.
        </p>
      ) : null}
    </div>
  );
}
