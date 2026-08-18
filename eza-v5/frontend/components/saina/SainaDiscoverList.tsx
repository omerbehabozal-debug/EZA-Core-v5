'use client';

import type { RefObject } from 'react';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  SAINA_DISCOVER_MORE_ERROR,
  SAINA_DISCOVER_MORE_RETRY,
} from '@/lib/eza/mirror-network/discoverCopy';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';

export type SainaDiscoverListProps = {
  items: DiscoverMirror[];
  loading?: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  onRetryLoadMore?: () => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  discoverLimitReached?: boolean;
  onDiscoverLimit?: () => void;
};

function DiscoverSkeletonCard() {
  return (
    <div className="saina-discover-card saina-discover-card--skeleton" aria-hidden>
      <div className="saina-discover-card__visual saina-discover-skeleton-block" />
      <div className="saina-discover-card__body">
        <div className="saina-discover-skeleton-line saina-discover-skeleton-line--title" />
        <div className="saina-discover-skeleton-line saina-discover-skeleton-line--short" />
        <div className="saina-discover-skeleton-line saina-discover-skeleton-line--cta" />
      </div>
    </div>
  );
}

export default function SainaDiscoverList({
  items,
  loading = false,
  loadingMore = false,
  loadMoreError = false,
  onRetryLoadMore,
  sentinelRef,
  discoverLimitReached = false,
  onDiscoverLimit,
}: SainaDiscoverListProps) {
  if (loading && items.length === 0) {
    return (
      <div className="saina-discover-list" data-testid="saina-discover-list-loading">
        <DiscoverSkeletonCard />
        <DiscoverSkeletonCard />
        <DiscoverSkeletonCard />
      </div>
    );
  }

  return (
    <div
      className="saina-discover-list"
      data-testid="saina-discover-list"
      aria-busy={loadingMore || undefined}
    >
      {items.map((item) => (
        <SainaDiscoverCard
          key={item.slug}
          item={item}
          discoverLimitReached={discoverLimitReached}
          onDiscoverLimit={onDiscoverLimit}
        />
      ))}
      <div
        ref={sentinelRef}
        className="saina-discover-prefetch-sentinel"
        data-testid="saina-discover-prefetch-sentinel"
        aria-hidden
      />
      {loadMoreError ? (
        <div
          className="saina-discover-state saina-discover-state--more"
          data-testid="saina-discover-more-error"
          role="status"
        >
          <p className="saina-discover-state__body">{SAINA_DISCOVER_MORE_ERROR}</p>
          <button
            type="button"
            className="saina-discover-retry"
            data-testid="saina-discover-more-retry"
            onClick={onRetryLoadMore}
          >
            {SAINA_DISCOVER_MORE_RETRY}
          </button>
        </div>
      ) : null}
    </div>
  );
}
