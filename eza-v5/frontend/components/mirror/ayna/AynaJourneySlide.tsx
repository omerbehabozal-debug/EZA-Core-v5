'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import MirrorPosterLightbox from '@/components/mirror/MirrorPosterLightbox';
import MirrorPublishShareActions from '@/components/mirror/MirrorPublishShareActions';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { resolveAynaGenerationErrorCopy } from '@/lib/eza/mirror/journey/resolveAynaReelSelectedIdentity';
import { resolveYansiProductFromArtifact } from '@/lib/eza/mirror/yansiProductPresentation';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { YansiPublicMetricsView } from '@/components/mirror-landing/YansiPublicMetricsLine';
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
  positionLabel?: string | null;
  className?: string;
  /**
   * Mobile Ayna sheet: publication preview of the canonical Yansı product.
   * Author/how/Devamı/social proof omitted; status + Yayınla outside the card.
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

export default function AynaJourneySlide({
  artifact,
  actions,
  publishBusy = false,
  shareBusy = false,
  canShare = true,
  positionLabel = null,
  className,
  compactPrimaryProduct = false,
}: AynaJourneySlideProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const product = resolveYansiProductFromArtifact(artifact);
  const { title, summary, sceneImageUrl: sceneUrl } = product;
  const authorName = artifact.authorDisplayName?.trim() || 'Yazar';
  const showParent = Boolean(
    artifact.parentJourneyId || artifact.parentSlug || artifact.parentAuthorDisplayName
  );
  const canonical = parseYansiPublicSocialProofInput(artifact);
  const isPublished = artifact.status === 'published';
  const isReady = artifact.status === 'ready';
  const isGenerating = artifact.status === 'generating';
  const isFailed = artifact.status === 'failed';
  const longSummary = Boolean(summary && summary.length > 160);
  /** Desktop only: optional expand. Compact/mobile shows full canonical summary. */
  const visibleSummary =
    compactPrimaryProduct
      ? summary
      : summary && longSummary && !summaryExpanded
        ? `${summary.slice(0, 160).trim()}…`
        : summary;
  const canFullscreen =
    compactPrimaryProduct && Boolean(sceneUrl) && (isReady || isPublished);
  const safeFailureDetail = resolveAynaGenerationErrorCopy(artifact.generationError);
  /** Mobile compact: never show reel ordinal chrome (e.g. "1 / 1"). */
  const showPosition = Boolean(positionLabel) && !compactPrimaryProduct;

  const authorBlock = (
    <>
      <AynaAuthorRow
        displayName={authorName}
        authorUserId={artifact.authorUserId}
        avatarUrl={artifact.authorAvatarUrl}
        onOpenProfile={() => actions.onOpenAuthorProfile(artifact)}
      />
      {showParent ? (
        <AynaParentLineageRow
          parentAuthorDisplayName={artifact.parentAuthorDisplayName}
          parentPublicTitle={artifact.parentPublicTitle}
          onOpenParent={
            artifact.parentSlug || artifact.parentJourneyId
              ? () => actions.onOpenParent(artifact)
              : undefined
          }
        />
      ) : null}
    </>
  );

  const publicationBlock = (
    <>
      <div className="ayna-journey-slide__status-row">
        <span
          className="text-[10px] font-medium uppercase tracking-wider text-[rgba(231,180,91,0.85)]"
          data-testid="ayna-slide-status"
        >
          ● {statusLabel(artifact)}
        </span>
        {showPosition ? (
          <span
            className="text-[10px] text-[rgba(217,196,163,0.55)]"
            data-testid="ayna-slide-position"
          >
            {positionLabel}
          </span>
        ) : null}
      </div>

      {/* Metrics are Discover/network state — never on Ayna publication preview. */}
      {!compactPrimaryProduct && canonical ? (
        <YansiPublicMetricsView
          experienceStartedCount={canonical.experienceStartedCount}
          directChildYansiCount={canonical.directChildYansiCount}
          slug={artifact.publish.slug ?? artifact.journeyId}
          journeyVersion={artifact.journeyVersion}
          className="ayna-journey-slide__metrics"
        />
      ) : null}

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
        ) : compactPrimaryProduct ? (
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
        ) : (
          <>
            <div className="ayna-journey-slide__meta ayna-journey-slide__meta--above">
              {authorBlock}
            </div>
            <YansiProductCard
              title={title}
              summary={visibleSummary}
              sceneImageUrl={sceneUrl}
              testIdPrefix={`ayna-slide-${artifact.journeyId}`}
              loadingLazy
              className="ayna-journey-slide__card"
            />
            <div className="ayna-journey-slide__meta">
              {summary && longSummary ? (
                <button
                  type="button"
                  className="mt-1 self-start text-[10px] text-[rgba(231,180,91,0.85)]"
                  onClick={() => setSummaryExpanded((v) => !v)}
                  data-testid="ayna-summary-toggle"
                >
                  {summaryExpanded ? 'Kısalt' : 'Devamını gör'}
                </button>
              ) : null}
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
