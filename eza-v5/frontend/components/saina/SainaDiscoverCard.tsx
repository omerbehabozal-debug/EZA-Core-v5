'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SAINA_DISCOVER_CTA,
  SAINA_DISCOVER_LIMIT_CTA,
  formatDiscoverYansiCount,
} from '@/lib/eza/mirror-network/discoverCopy';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { startDiscoverGuestChatFromSlug } from '@/lib/eza/mirror-network/startDiscoverGuestChat';
import { isQuotaLimitReason } from '@/lib/eza/plan/sainaQuotaMessages';

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
  const router = useRouter();
  const hasImage = Boolean(item.sceneImageUrl?.trim());
  const [imageFailed, setImageFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const showImage = hasImage && !imageFailed;
  const summary = item.description?.trim() || null;

  const handleStartChat = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setStartError(false);

    const result = await startDiscoverGuestChatFromSlug(
      item.slug,
      SAINA_DISCOVER_CTA,
      item.title
    );
    if (!result.ok) {
      setStarting(false);
      if (result.status === 403 && result.quotaDetail && isQuotaLimitReason(result.quotaDetail.reason)) {
        onDiscoverLimit?.();
        return;
      }
      setStartError(true);
      return;
    }

    router.push(result.href);
  }, [item.slug, item.title, onDiscoverLimit, router, starting]);

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
          <div
            className="saina-discover-card__placeholder"
            aria-hidden
            data-testid="saina-discover-card-placeholder"
          />
        )}
      </div>

      <div className="saina-discover-card__body">
        <h2 className="saina-discover-card__title saina-serif">{item.title}</h2>
        {summary ? <p className="saina-discover-card__summary">{summary}</p> : null}
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
          <button
            type="button"
            className="saina-discover-card__cta"
            onClick={() => void handleStartChat()}
            disabled={starting}
            data-testid={`saina-discover-card-cta-${item.slug}`}
          >
            {starting ? 'Sohbet açılıyor…' : SAINA_DISCOVER_CTA}
          </button>
        )}
        {startError ? (
          <p className="saina-discover-card__error" role="alert">
            Bu merak için sohbet şu an açılamıyor.
          </p>
        ) : null}
      </div>
    </article>
  );
}
