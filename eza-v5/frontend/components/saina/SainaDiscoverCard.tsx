'use client';
import '@/styles/saina-my-page.css';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import {
  SAINA_DISCOVER_OPEN_CTA,
  SAINA_DISCOVER_OPEN_CTA_SHORT,
} from '@/lib/eza/mirror-network/discoverCopy';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { buildMirrorPublicPath } from '@/lib/eza/mirror-network/mirrorPublicUrl';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { resolveYansiProductFromDiscoverItem } from '@/lib/eza/mirror/yansiProductPresentation';
import { YansiPublicMetricsView } from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import SainaYansiSaveControl from './SainaYansiSaveControl';

export type SainaDiscoverCardProps = {
  item: DiscoverMirror;
  /** Collection-only control. Discover cards expose the existing open action alone. */
  showSave?: boolean;
  authorUserId?: string | null;
  presentation?: 'discover' | 'owner-publication';
  /** @deprecated Phase 8.2 — card opens /m/{slug}; limit applies at continuation/sohbet. */
  discoverLimitReached?: boolean;
  /** @deprecated Phase 8.2 */
  onDiscoverLimit?: () => void;
};

export default function SainaDiscoverCard({
  item,
  showSave = false,
  presentation = 'discover',
  authorUserId,
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
      <ProfileUserAvatar
        displayName={authorName}
        avatarUrl={item.publicAvatarUrl}
        cacheBust={item.publicAvatarRevision ?? undefined}
        size="sm"
        className="saina-discover-card__identity-avatar"
        alt=""
      />
      <span className="saina-discover-card__identity-name">{authorName}</span>
      {item.publisherKind === 'business' ? <span className="text-xs text-[#C6A46B]">Business</span> : <HonorificMarker honorific={item.publicHonorific} size="sm" />}
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
        className={`saina-discover-card--editorial${presentation === 'owner-publication' ? ' saina-discover-card--owner-publication' : ''}`}
        kicker={identity}
        meta={
          canonical ? (
            <YansiPublicMetricsView
              experienceStartedCount={canonical.experienceStartedCount}
              directChildYansiCount={canonical.directChildYansiCount}
              visibleVerificationCount={item.visibleVerificationCount ?? 0}
              contentVisibleCount={item.contentVisibleCount ?? 0}
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
          <div className="saina-discover-card__actions">
          <button
            type="button"
            className="saina-discover-card__cta"
            onClick={handleOpenYansi}
            data-testid={`saina-discover-card-cta-${item.slug}`}
          >
            <span className="saina-discover-card__cta-label">
              {SAINA_DISCOVER_OPEN_CTA}
            </span>
            <span className="saina-discover-card__cta-short" aria-hidden>
              {SAINA_DISCOVER_OPEN_CTA_SHORT}
            </span>
            <span className="saina-discover-card__cta-mobile">{presentation === 'owner-publication' ? 'Görüntüle' : 'Deneyimle'}</span>
          </button>
          {showSave ? <SainaYansiSaveControl slug={item.slug} authorUserId={authorUserId} /> : null}
          </div>
        }
      />
    </YansiExposureRoot>
  );
}
