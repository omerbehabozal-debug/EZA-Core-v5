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
  /** Compact creator identity (name + honorific). Display only. */
  kicker?: ReactNode;
  /** Capture root for share PNG / export. */
  captureRef?: React.Ref<HTMLElement>;
  /**
   * Visual-only surface: omit body when copy is rendered outside the card.
   * Prefer canonicalProduct + title/summary for Ayna/Discover product parity.
   */
  visualOnly?: boolean;
  /**
   * Marks the shared Ayna↔Discover product shell (visual → title → summary).
   * Context slots (kicker/meta/footer) remain surface-specific.
   */
  canonicalProduct?: boolean;
};

/**
 * Single public Mirror card — Ayna preview, Discover, landing, and share.
 * Product core: visual → title → summary. Surface CTAs via `footer` / kicker / meta.
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
  kicker,
  captureRef,
  visualOnly = false,
  canonicalProduct = false,
}: MirrorPublicCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(sceneImageUrl?.trim()) && !imageFailed;
  const articleTestId = slug
    ? `${testIdPrefix}-${slug}`
    : testIdPrefix;
  const hasProductCopy = Boolean(title.trim() || summary?.trim());
  const hasContext = Boolean(kicker || meta || metaLabel?.trim() || footer);
  const showBody = !visualOnly && (hasProductCopy || hasContext);

  return (
    <article
      ref={captureRef as React.Ref<HTMLElement>}
      className={cn(
        'saina-discover-card saina-mirror-public-card',
        visualOnly && 'saina-discover-card--visual-only',
        canonicalProduct && 'saina-discover-card--canonical-product',
        className
      )}
      data-testid={articleTestId}
      data-mirror-public-card
      data-canonical-yansi-product={canonicalProduct ? 'true' : undefined}
      data-visual-only={visualOnly ? 'true' : undefined}
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

      {showBody ? (
        <div className="saina-discover-card__body">
          {kicker}
          {hasProductCopy ? (
            <div
              className="saina-discover-card__product-core"
              data-yansi-product-core
            >
              {title.trim() ? (
                <h2
                  className="saina-discover-card__title saina-serif"
                  data-testid={
                    slug
                      ? `${testIdPrefix}-title-${slug}`
                      : `${testIdPrefix}-title`
                  }
                >
                  {title}
                </h2>
              ) : null}
              {summary?.trim() ? (
                <p
                  className="saina-discover-card__summary"
                  data-testid={
                    slug
                      ? `${testIdPrefix}-summary-${slug}`
                      : `${testIdPrefix}-summary`
                  }
                >
                  {summary.trim()}
                </p>
              ) : null}
            </div>
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
      ) : null}
    </article>
  );
}
