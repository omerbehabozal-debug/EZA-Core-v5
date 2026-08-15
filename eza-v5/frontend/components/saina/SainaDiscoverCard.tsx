'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';
import {
  SAINA_DISCOVER_CTA,
  SAINA_DISCOVER_LIMIT_CTA,
} from '@/lib/eza/mirror-network/discoverCopy';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { startDiscoverGuestChatFromSlug } from '@/lib/eza/mirror-network/startDiscoverGuestChat';
import { isQuotaLimitReason } from '@/lib/eza/plan/sainaQuotaMessages';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { YansiPublicMetricsView } from '@/components/mirror-landing/YansiPublicMetricsLine';

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
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const summary = item.description?.trim() || null;
  const canonical = parseYansiPublicSocialProofInput(item);

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
    <MirrorPublicCard
      title={item.title}
      summary={summary}
      sceneImageUrl={item.sceneImageUrl}
      meta={
        canonical ? (
          <YansiPublicMetricsView
            experienceStartedCount={canonical.experienceStartedCount}
            directChildYansiCount={canonical.directChildYansiCount}
            variant="card"
            slug={item.slug}
            journeyVersion={item.journeyVersion ?? undefined}
          />
        ) : null
      }
      slug={item.slug}
      testIdPrefix="saina-discover-card"
      loadingLazy
      footer={
        <>
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
        </>
      }
    />
  );
}
