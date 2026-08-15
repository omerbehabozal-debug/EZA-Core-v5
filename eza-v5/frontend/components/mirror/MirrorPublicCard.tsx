'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MirrorPublicCardProps = {
  title: string;
  summary?: string | null;
  sceneImageUrl?: string | null;
  /** Optional meta under summary (Yansı count, published status, …). */
  metaLabel?: string | null;
  className?: string;
  /** Keep discover testids when rendering Discover feed cards. */
  testIdPrefix?: string;
  slug?: string;
  loadingLazy?: boolean;
  onOpenFullscreen?: () => void;
  expandLabel?: string;
  footer?: ReactNode;
  /** Quiet metadata row (Phase 6.2). Takes precedence over metaLabel. */
  meta?: ReactNode;
  /** Capture root for share PNG / export. */
  captureRef?: React.Ref<HTMLElement>;
};

/**
 * Single public Mirror card — preview, Discover, landing, and share surfaces.
 * Visual on top, title + summary below. Surface-specific CTAs via `footer`.
 */
export default function MirrorPublicCard({
  title,
  summary,
  sceneImageUrl,
  metaLabel,
  className,
  testIdPrefix = 'mirror-public-card',
  slug,
  loadingLazy = false,
  onOpenFullscreen,
  expandLabel = 'Büyüt',
  footer,
  meta,
  captureRef,
}: MirrorPublicCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(sceneImageUrl?.trim()) && !imageFailed;
  const articleTestId = slug
    ? `${testIdPrefix}-${slug}`
    : testIdPrefix;

  return (
    <article
      ref={captureRef as React.Ref<HTMLElement>}
      className={cn('saina-discover-card saina-mirror-public-card', className)}
      data-testid={articleTestId}
      data-mirror-public-card
    >
      <div className="saina-discover-card__visual">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic scene URL
          <img
            src={sceneImageUrl!}
            alt=""
            className="saina-discover-card__image"
            loading={loadingLazy ? 'lazy' : undefined}
            decoding="async"
            onError={() => setImageFailed(true)}
            data-testid={
              slug ? 'saina-discover-card-image' : `${testIdPrefix}-image`
            }
          />
        ) : (
          <div
            className="saina-discover-card__placeholder"
            aria-hidden
            data-testid={
              slug ? 'saina-discover-card-placeholder' : `${testIdPrefix}-placeholder`
            }
          />
        )}
        {onOpenFullscreen ? (
          <button
            type="button"
            className="saina-mirror-public-preview__expand"
            onClick={onOpenFullscreen}
            aria-label="Aynayı tam boyutta gör"
            data-testid={`${testIdPrefix}-expand`}
          >
            {expandLabel}
          </button>
        ) : null}
      </div>

      <div className="saina-discover-card__body">
        <h2 className="saina-discover-card__title saina-serif">{title}</h2>
        {summary?.trim() ? (
          <p className="saina-discover-card__summary">{summary.trim()}</p>
        ) : null}
        {meta ? (
          meta
        ) : metaLabel?.trim() ? (
          <p
            className="saina-discover-card__yansi saina-mirror-public-card__meta"
            data-testid={`${testIdPrefix}-meta`}
          >
            {metaLabel.trim()}
          </p>
        ) : null}
        {footer}
      </div>
    </article>
  );
}
