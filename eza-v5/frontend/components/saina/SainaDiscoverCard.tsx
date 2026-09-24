'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import {
  SAINA_DISCOVER_OPEN_CTA,
} from '@/lib/eza/mirror-network/discoverCopy';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { buildMirrorPublicPath } from '@/lib/eza/mirror-network/mirrorPublicUrl';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { resolveYansiProductFromDiscoverItem } from '@/lib/eza/mirror/yansiProductPresentation';
import { YansiPublicMetricsView } from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import { resolvePublicAvatarGrapheme } from '@/lib/eza/mirror/publicIdentity';

export type SainaDiscoverCardProps = {
  item: DiscoverMirror;
  /** @deprecated Phase 8.2 — card opens /m/{slug}; limit applies at continuation/sohbet. */
  discoverLimitReached?: boolean;
  /** @deprecated Phase 8.2 */
  onDiscoverLimit?: () => void;
};

export default function SainaDiscoverCard({
  item,
}: SainaDiscoverCardProps) {
  const router = useRouter();
  const product = resolveYansiProductFromDiscoverItem(item);
  const canonical = parseYansiPublicSocialProofInput(item);
  const authorName = item.authorDisplayName?.trim() || '';
  const journeyVersion =
    typeof item.journeyVersion === 'number' &&
    Number.isInteger(item.journeyVersion) &&
    item.journeyVersion >= 1
      ? item.journeyVersion
      : null;

  const handleOpenYansi = useCallback(() => {
    // PUSH — Discover → Reel depth. Pin journeyVersion when Discover provides it.
    router.push(
      buildMirrorPublicPath(item.slug, { journeyVersion })
    );
  }, [item.slug, journeyVersion, router]);

  const identity = authorName ? (
    <div
      className="saina-discover-card__identity"
      data-testid={`saina-discover-card-identity-${item.slug}`}
    >
      <span className="saina-discover-card__identity-avatar" aria-hidden>
        {resolvePublicAvatarGrapheme(authorName)}
      </span>
      <span className="saina-discover-card__identity-name">{authorName}</span>
      <HonorificMarker honorific={item.publicHonorific} size="sm" />
    </div>
  ) : null;

  return (
    <YansiExposureRoot
      slug={item.slug}
      journeyVersion={item.journeyVersion ?? null}
      context="discover"
    >
      <YansiProductCard
        title={product.title}
        summary={product.summary}
        sceneImageUrl={product.sceneImageUrl}
        kicker={identity}
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
        onActivateProduct={handleOpenYansi}
        activateProductLabel={`${product.title} — Yansıyı aç`}
        footer={
          <button
            type="button"
            className="saina-discover-card__cta"
            onClick={handleOpenYansi}
            data-testid={`saina-discover-card-cta-${item.slug}`}
          >
            {SAINA_DISCOVER_OPEN_CTA}
          </button>
        }
      />
    </YansiExposureRoot>
  );
}
