'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SAINA_DISCOVER_CTA,
  SAINA_DISCOVER_LIMIT_CTA,
  formatDiscoverYansiCount,
} from '@/lib/eza/mirror-network/discoverCopy';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

export type SainaDiscoverCardProps = {
  item: DiscoverMirror;
  discoverLimitReached?: boolean;
  onDiscoverLimit?: () => void;
};

export default function SainaDiscoverCard({
  item,
  discoverLimitReached = false,
  onDiscoverLimit,
}: SainaDiscoverCardProps) {
  const href = `/m/${encodeURIComponent(item.slug)}/sohbet`;
  const hasImage = Boolean(item.sceneImageUrl?.trim());
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = hasImage && !imageFailed;

  return (
    <article className="saina-discover-card" data-testid={`saina-discover-card-${item.slug}`}>
      <div className="saina-discover-card__visual">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- public mirror scene URL
          <img
            src={item.sceneImageUrl!}
            alt=""
            className="saina-discover-card__image"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            data-testid="saina-discover-card-image"
          />
        ) : (
          <div className="saina-discover-card__placeholder" aria-hidden data-testid="saina-discover-card-placeholder" />
        )}
      </div>

      <div className="saina-discover-card__body">
        <h2 className="saina-discover-card__title saina-serif">{item.title}</h2>
        <p className="saina-discover-card__yansi">{formatDiscoverYansiCount(item.yansiCount)}</p>
        {discoverLimitReached ? (
          <button
            type="button"
            className="saina-discover-card__cta"
            onClick={onDiscoverLimit}
            data-testid={`saina-discover-card-limit-${item.slug}`}
          >
            {SAINA_DISCOVER_LIMIT_CTA}
          </button>
        ) : (
          <Link href={href} className="saina-discover-card__cta">
            {SAINA_DISCOVER_CTA}
          </Link>
        )}
      </div>
    </article>
  );
}
