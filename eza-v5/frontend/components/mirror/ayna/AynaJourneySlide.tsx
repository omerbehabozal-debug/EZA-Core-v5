'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import MirrorPosterLightbox from '@/components/mirror/MirrorPosterLightbox';
import MirrorPublishShareActions from '@/components/mirror/MirrorPublishShareActions';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { resolveAynaGenerationErrorCopy } from '@/lib/eza/mirror/journey/resolveAynaReelSelectedIdentity';
import { resolveYansiProductFromArtifact } from '@/lib/eza/mirror/yansiProductPresentation';
import {
  MIRROR_JOURNEY_STATUS_GENERATING,
  MIRROR_JOURNEY_STATUS_READY,
  MIRROR_AYNA_STATUS_PUBLISHED,
} from '@/lib/eza/mirror/copy';

export type AynaJourneySlideActions = {
  onPublish: (artifact: MirrorJourneyArtifact) => void;
  onShare: (artifact: MirrorJourneyArtifact) => void;
  onOpenDiscover: (artifact: MirrorJourneyArtifact) => void;
  onOpenAuthorProfile: (artifact: MirrorJourneyArtifact) => void;
  onOpenParent: (artifact: MirrorJourneyArtifact) => void;
  onOpenChildren?: (artifact: MirrorJourneyArtifact) => void;
  onRetry?: (artifact: MirrorJourneyArtifact) => void;
};

export type AynaJourneySlideProps = {
  artifact: MirrorJourneyArtifact;
  actions: AynaJourneySlideActions;
  publishBusy?: boolean;
  shareBusy?: boolean;
  canShare?: boolean;
  /** @deprecated Reel ordinal chrome — never shown on Ayna publication preview. */
  positionLabel?: string | null;
  className?: string;
  /**
   * Mobile sheet layout hook (sizing CSS). Product presentation is identical
   * on mobile and desktop: canonical YansiProductCard + publication controls.
   */
  compactPrimaryProduct?: boolean;
};

function statusLabel(artifact: MirrorJourneyArtifact): string {
  switch (artifact.status) {
    case 'generating':
      return MIRROR_JOURNEY_STATUS_GENERATING;
    case 'ready':
      return MIRROR_JOURNEY_STATUS_READY;
    case 'published':
      return MIRROR_AYNA_STATUS_PUBLISHED;
    case 'failed':
      return 'Yansı oluşturulamadı.';
    default:
      return '';
  }
}

/**
 * Ayna publication preview — mobile and desktop share one product shell with Discover.
 * Author / metrics / how / reel ordinal stay outside the canonical Yansı.
 */
export default function AynaJourneySlide({
  artifact,
  actions,
  publishBusy = false,
  shareBusy = false,
  canShare = true,
  className,
  compactPrimaryProduct = false,
}: AynaJourneySlideProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const product = resolveYansiProductFromArtifact(artifact);
  const { title, summary, sceneImageUrl: sceneUrl } = product;
  const isPublished = artifact.status === 'published';
  const isReady = artifact.status === 'ready';
  const isGenerating = artifact.status === 'generating';
  const isFailed = artifact.status === 'failed';
  const canFullscreen = Boolean(sceneUrl) && (isReady || isPublished);
  const safeFailureDetail = resolveAynaGenerationErrorCopy(artifact.generationError);

  const publicationBlock = (
    <>
      <div className="ayna-journey-slide__status-row">
        <span
          className="text-[10px] font-medium uppercase tracking-wider text-[rgba(231,180,91,0.85)]"
          data-testid="ayna-slide-status"
        >
          ● {statusLabel(artifact)}
        </span>
      </div>

      {(isReady || isPublished) && (
        <MirrorPublishShareActions
          isPublished={isPublished}
          publishBusy={publishBusy}
          shareBusy={shareBusy}
          canShare={canShare}
          onPublish={() => actions.onPublish(artifact)}
          onShare={() => actions.onShare(artifact)}
          onOpenPublic={
            isPublished ? () => actions.onOpenDiscover(artifact) : undefined
          }
          className="mt-2"
        />
      )}
    </>
  );

  return (
    <section
      className={cn(
        'ayna-journey-slide',
        compactPrimaryProduct && 'ayna-journey-slide--compact-primary',
        className
      )}
      data-testid="ayna-journey-slide"
      data-journey-id={artifact.journeyId}
      data-journey-version={artifact.journeyVersion}
      data-artifact-status={artifact.status}
      data-compact-primary={compactPrimaryProduct ? 'true' : undefined}
      aria-label={title}
    >
      <div className="ayna-journey-slide__inner">
        {isGenerating ? (
          <div
            className="ayna-journey-slide__skeleton"
            data-testid="ayna-slide-generating"
            role="status"
            aria-live="polite"
          >
            <div className="ayna-journey-slide__skeleton-visual" aria-hidden />
            <div className="flex items-center gap-2 text-[11px] text-[rgba(217,196,163,0.8)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {statusLabel(artifact)}
            </div>
          </div>
        ) : isFailed ? (
          <div
            className="ayna-journey-slide__failed"
            data-testid="ayna-slide-failed"
            role="status"
          >
            <p className="text-sm text-[rgba(246,244,239,0.88)]">{statusLabel(artifact)}</p>
            {safeFailureDetail ? (
              <p className="mt-1 text-[11px] text-[rgba(217,196,163,0.7)]">
                {safeFailureDetail}
              </p>
            ) : null}
            {actions.onRetry ? (
              <button
                type="button"
                className="mt-3 inline-flex rounded-full border border-white/12 px-4 py-2 text-[11px]"
                onClick={() => actions.onRetry?.(artifact)}
                data-testid="ayna-slide-retry"
              >
                Tekrar dene
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <YansiProductCard
              title={title}
              summary={summary}
              sceneImageUrl={sceneUrl}
              testIdPrefix={`ayna-slide-${artifact.journeyId}`}
              loadingLazy
              onOpenFullscreen={
                canFullscreen ? () => setLightboxOpen(true) : undefined
              }
              className="ayna-journey-slide__card"
            />
            <div
              className="ayna-journey-slide__publication"
              data-testid="ayna-slide-publication"
            >
              {publicationBlock}
            </div>
          </>
        )}
      </div>

      {canFullscreen ? (
        <MirrorPosterLightbox
          open={lightboxOpen}
          imageUrl={sceneUrl}
          title={title}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </section>
  );
}
