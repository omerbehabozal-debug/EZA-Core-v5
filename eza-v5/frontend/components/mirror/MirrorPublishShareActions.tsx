'use client';

import { Loader2, Share2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_PUBLISH_LABEL,
  MIRROR_REPUBLISH_LABEL,
  MIRROR_PUBLISH_DONE_LABEL,
  MIRROR_PUBLISH_BUSY_LABEL,
  MIRROR_PUBLISH_FAILED_LABEL,
  MIRROR_PUBLISH_LIVE_LABEL,
  MIRROR_SHARE_SOCIAL_LABEL,
  MIRROR_NEW_SCENE_LABEL,
  MIRROR_SCENE_GENERATING,
} from '@/lib/eza/mirror/copy';
import { canRequestNewSceneVariation } from '@/lib/eza/mirror/mirrorSceneVariation';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

export type MirrorPublishShareActionsProps = {
  isPublished: boolean;
  publishBusy?: boolean;
  shareBusy?: boolean;
  canShare?: boolean;
  publishError?: string | null;
  showNewScene?: boolean;
  sceneImageStatus?: MirrorSceneImageStatus;
  hasProductionQuota?: boolean;
  onPublish: () => void;
  onShare: () => void;
  onOpenPublic?: () => void;
  onNewScene?: () => void;
  className?: string;
};

const primaryClass = cn(
  'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold tracking-tight',
  'border border-[rgba(231,180,91,0.42)] text-[#f6f0e4]',
  'bg-[linear-gradient(165deg,rgba(231,180,91,0.28)_0%,rgba(231,180,91,0.14)_100%)]',
  'transition-opacity hover:opacity-95',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(231,180,91,0.45)]',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const secondaryClass = cn(
  'inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 py-2.5 text-xs font-medium tracking-tight text-[rgba(246,244,239,0.88)]',
  'transition-colors hover:bg-white/[0.1]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const quietClass = cn(
  'inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-transparent px-4 py-2 text-[11px] font-medium tracking-tight text-[rgba(217,196,163,0.7)]',
  'transition-colors hover:text-[rgba(246,244,239,0.88)] hover:bg-white/[0.04]',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

export default function MirrorPublishShareActions({
  isPublished,
  publishBusy = false,
  shareBusy = false,
  canShare = true,
  publishError = null,
  showNewScene = false,
  sceneImageStatus = 'idle',
  hasProductionQuota = true,
  onPublish,
  onShare,
  onOpenPublic,
  onNewScene,
  className,
}: MirrorPublishShareActionsProps) {
  const isGenerating = sceneImageStatus === 'generating';
  const canNewScene =
    showNewScene &&
    typeof onNewScene === 'function' &&
    canRequestNewSceneVariation(true, sceneImageStatus, hasProductionQuota);

  return (
    <div
      className={cn('flex w-full max-w-sm flex-col items-stretch gap-2', className)}
      role="group"
      aria-label="Ayna yayınla ve paylaş"
      data-testid="mirror-publish-share-actions"
    >
      <button
        type="button"
        className={primaryClass}
        onClick={onPublish}
        disabled={publishBusy}
        aria-busy={publishBusy}
        data-testid={isPublished ? 'mirror-republish-btn' : 'mirror-publish-btn'}
      >
        {publishBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {publishBusy
          ? MIRROR_PUBLISH_BUSY_LABEL
          : isPublished
            ? MIRROR_REPUBLISH_LABEL
            : MIRROR_PUBLISH_LABEL}
      </button>
      {isPublished && !publishBusy ? (
        <p
          className="text-center text-[11px] font-medium text-[rgba(231,180,91,0.9)]"
          data-testid="mirror-publish-live-status"
          role="status"
        >
          {MIRROR_PUBLISH_LIVE_LABEL}
        </p>
      ) : null}
      {publishError && !publishBusy ? (
        <p
          className="text-center text-[11px] text-red-300/90"
          data-testid="mirror-publish-error"
          role="alert"
        >
          {publishError || MIRROR_PUBLISH_FAILED_LABEL}
        </p>
      ) : null}

      {isPublished && onOpenPublic ? (
        <button
          type="button"
          className={secondaryClass}
          onClick={onOpenPublic}
          data-testid="mirror-publish-open-public"
        >
          {MIRROR_PUBLISH_DONE_LABEL}
        </button>
      ) : null}

      {isPublished ? (
      <button
        type="button"
        className={quietClass}
        onClick={onShare}
        disabled={!canShare || shareBusy || publishBusy}
        aria-busy={shareBusy}
        data-testid="mirror-share-social-btn"
      >
        {shareBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Share2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
        )}
        {MIRROR_SHARE_SOCIAL_LABEL}
      </button>
      ) : null}

      {canNewScene ? (
        <button
          type="button"
          className={quietClass}
          onClick={onNewScene}
          disabled={!canRequestNewSceneVariation(true, sceneImageStatus, hasProductionQuota)}
          aria-busy={isGenerating}
          data-testid="mirror-new-scene-btn"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 opacity-80" aria-hidden />
          )}
          {isGenerating ? MIRROR_SCENE_GENERATING : MIRROR_NEW_SCENE_LABEL}
        </button>
      ) : null}
    </div>
  );
}
