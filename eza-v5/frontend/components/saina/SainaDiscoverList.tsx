'use client';

import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';

export type SainaDiscoverListProps = {
  items: DiscoverMirror[];
  loading?: boolean;
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
  discoverLimitReached = false,
  onDiscoverLimit,
}: SainaDiscoverListProps) {
  if (loading) {
    return (
      <div className="saina-discover-list" data-testid="saina-discover-list-loading">
        <DiscoverSkeletonCard />
        <DiscoverSkeletonCard />
        <DiscoverSkeletonCard />
      </div>
    );
  }

  return (
    <div className="saina-discover-list" data-testid="saina-discover-list">
      {items.map((item) => (
        <SainaDiscoverCard
          key={item.slug}
          item={item}
          discoverLimitReached={discoverLimitReached}
          onDiscoverLimit={onDiscoverLimit}
        />
      ))}
    </div>
  );
}
