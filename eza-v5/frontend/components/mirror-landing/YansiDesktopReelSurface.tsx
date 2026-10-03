'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import BilignAvatarIdentityFrame from '@/components/mirror/ayna/BilignAvatarIdentityFrame';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import YansiPublicMetricsLine from '@/components/mirror-landing/YansiPublicMetricsLine';
import {
  YANSI_DETAIL_CLOSE,
  YANSI_DETAIL_OPEN,
} from '@/lib/eza/mirror/copy';
import {
  formatYansiHeroMetaTime,
  YANSI_HERO_META_TYPE_YANSI,
} from '@/lib/eza/mirror/yansiHeroMeta';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { assertYansiAtomicIdentity } from '@/lib/eza/mirror/journey/yansiAtomicIdentity';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { buildYansiPublicHref } from '@/lib/eza/mirror-network/yansiPublicDepth';
import { cn } from '@/lib/utils';
import {
  YANSI_REEL_EASE,
  YANSI_REEL_REDUCED_MS,
  YANSI_REEL_TRAVEL_MS,
  yansiReelSurfaceOpacity,
  yansiReelSurfaceTransform,
  type YansiReelTravelDirection,
} from '@/lib/eza/mirror/journey/yansiDesktopReelTransition';

export type YansiDesktopReelSurfaceNode = {
  artifact: PublicFrozenJourneyArtifact;
  authorDisplayName: string;
  authorHonorific: string;
  authorAvatarUrl: string | null;
  authorAvatarRevision: number | null;
  parentAuthorDisplayName: string | null;
  parentPublicTitle: string | null;
};

export type YansiDesktopReelSurfaceRole = 'current' | 'outgoing' | 'incoming';

export default function YansiDesktopReelSurface({
  node,
  role,
  direction = null,
  traveling = false,
  reducedMotion = false,
  detailOpen = false,
  onDetailToggle,
  onOpenChat,
  rail,
}: {
  node: YansiDesktopReelSurfaceNode;
  role: YansiDesktopReelSurfaceRole;
  direction?: YansiReelTravelDirection | null;
  traveling?: boolean;
  reducedMotion?: boolean;
  detailOpen?: boolean;
  onDetailToggle?: () => void;
  onOpenChat?: () => void;
  rail?: ReactNode;
}) {
  const router = useRouter();
  const slug = node.artifact.slug.trim().toLowerCase();
  const title = node.artifact.publicTitle || 'Yansı';
  const sceneUrl = (node.artifact.sceneImageUrl || '').trim();
  const summary = (node.artifact.publicSummary || '').trim();
  const publicMetaTime = node.artifact.publishedAt
    ? formatYansiHeroMetaTime(node.artifact.publishedAt)
    : '';
  const publicMetaType = YANSI_HERO_META_TYPE_YANSI;
  const committed = role !== 'incoming';
  const identity = assertYansiAtomicIdentity(node.artifact, {
    expectedSlug: slug,
    renderedTitle: node.artifact.publicTitle,
    renderedSceneUrl: node.artifact.sceneImageUrl,
  });

  const durationMs = reducedMotion ? YANSI_REEL_REDUCED_MS : YANSI_REEL_TRAVEL_MS;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fromTransform = yansiReelSurfaceTransform(role, direction, false, reducedMotion);
  const toTransform = yansiReelSurfaceTransform(role, direction, true, reducedMotion);
  const fromOpacity = yansiReelSurfaceOpacity(role, false, reducedMotion);
  const toOpacity = yansiReelSurfaceOpacity(role, true, reducedMotion);

  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el || role === 'current' || !direction) return;
    const canAnimate = typeof el.animate === 'function';
    if (typeof el.getAnimations === 'function') {
      el.getAnimations().forEach((anim) => anim.cancel());
    }
    if (!traveling || !canAnimate) {
      el.style.transform = traveling ? toTransform : fromTransform;
      el.style.opacity = String(traveling ? toOpacity : fromOpacity);
      return;
    }
    const anim = el.animate(
      [
        { transform: fromTransform, opacity: fromOpacity },
        { transform: toTransform, opacity: toOpacity },
      ],
      { duration: durationMs, easing: YANSI_REEL_EASE, fill: 'forwards' }
    );
    return () => anim.cancel();
  }, [
    direction,
    durationMs,
    fromOpacity,
    fromTransform,
    role,
    toOpacity,
    toTransform,
    traveling,
  ]);

  return (
    <div
      ref={surfaceRef}
      className="yansi-desktop-reel-surface"
      data-testid={`yansi-desktop-reel-surface-${role}`}
      data-yansi-surface-role={role}
      data-yansi-surface-slug={slug}
      data-yansi-travel-direction={direction || undefined}
      data-yansi-traveling={traveling ? 'true' : 'false'}
      data-yansi-reduced-motion={reducedMotion ? 'true' : undefined}
      style={{
        transform: yansiReelSurfaceTransform(role, direction, traveling, reducedMotion),
        opacity: yansiReelSurfaceOpacity(role, traveling, reducedMotion),
        transition: `transform ${durationMs}ms ${YANSI_REEL_EASE}, opacity ${durationMs}ms ${YANSI_REEL_EASE}`,
      }}
      data-yansi-identity-slug={identity.slug}
      data-yansi-identity-generation={identity.generationId || undefined}
      data-yansi-identity-asset={identity.imageAssetId || undefined}
    >
      <div
        className="yansi-desktop-scene-canvas"
        data-testid={
          committed ? 'mirror-yansi-scene-crossfade' : 'mirror-yansi-scene-incoming'
        }
        data-yansi-scene-presentation="desktop-immersive"
        data-yansi-scene-crop="shared-cover"
        data-yansi-scene-slug={slug}
        aria-hidden
      >
        <div className="yansi-desktop-scene-stack">
          {sceneUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneUrl}
                alt=""
                className="yansi-desktop-scene-bleed"
                data-yansi-layer="atmosphere"
              />
              <div className="yansi-desktop-scene-bleed-dim" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneUrl}
                alt=""
                className="yansi-desktop-scene-image"
                data-yansi-plate="sharp"
                data-yansi-scene-src={sceneUrl}
                data-testid={
                  committed ? 'mirror-yansi-scene-current' : 'mirror-yansi-scene-incoming-image'
                }
              />
            </>
          ) : null}
        </div>
      </div>
      <div className="yansi-desktop-atmosphere" aria-hidden data-testid="yansi-desktop-atmosphere" />

      <header
        className="yansi-desktop-visual-stack"
        data-yansi-title-position="lower"
        data-yansi-detail-open={detailOpen ? 'true' : 'false'}
        data-testid={committed ? 'yansi-title-block' : 'yansi-incoming-title-block'}
        data-yansi-copy-overlay="true"
        data-yansi-active-identity={slug}
      >
        <div
          className="yansi-desktop-identity"
          data-testid={committed ? 'yansi-desktop-identity' : 'yansi-incoming-identity'}
          data-yansi-active-identity={slug}
          data-yansi-author-id={node.artifact.authorUserId}
          data-yansi-avatar-authority="canonical-profile"
          data-bilign-identity-role="publisher"
        >
          <button
            type="button"
            className="yansi-desktop-identity__author"
            data-testid={
              committed ? 'yansi-desktop-public-author' : 'yansi-incoming-public-author'
            }
            onClick={() => router.push(authorProfilePath(node.artifact.authorUserId))}
          >
            <BilignAvatarIdentityFrame variant="publisher">
              <ProfileUserAvatar
                displayName={node.authorDisplayName}
                userId={node.artifact.authorUserId}
                avatarUrl={node.authorAvatarUrl}
                cacheBust={node.authorAvatarRevision ?? undefined}
                size="sm"
                className="yansi-desktop-identity__avatar"
              />
            </BilignAvatarIdentityFrame>
            <span className="yansi-desktop-identity__copy">
              <span className="yansi-desktop-identity__name-row">
                <span className="yansi-desktop-identity__name">{node.authorDisplayName}</span>
                {node.authorHonorific ? (
                  <HonorificMarker
                    honorific={node.authorHonorific}
                    testId={
                      committed
                        ? 'yansi-desktop-public-honorific'
                        : 'yansi-incoming-public-honorific'
                    }
                  />
                ) : null}
              </span>
              {publicMetaTime || publicMetaType ? (
                <p
                  className="yansi-desktop-identity__meta"
                  data-testid={
                    committed ? 'yansi-desktop-public-meta' : 'yansi-incoming-public-meta'
                  }
                >
                  {publicMetaTime ? (
                    <span data-testid="yansi-desktop-public-meta-time">{publicMetaTime}</span>
                  ) : null}
                  {publicMetaTime && publicMetaType ? (
                    <span aria-hidden="true"> · </span>
                  ) : null}
                  {publicMetaType ? (
                    <span data-testid="yansi-desktop-public-meta-type">{publicMetaType}</span>
                  ) : null}
                </p>
              ) : null}
            </span>
          </button>
        </div>
        <button
          type="button"
          className="yansi-reel-title-trigger w-full text-left font-medium tracking-tight text-[#f5ead8] yansi-desktop-editorial-title"
          data-testid={committed ? 'mirror-yansi-active-title' : 'mirror-yansi-incoming-title'}
          data-slug={node.artifact.slug}
          data-yansi-active-identity={slug}
          data-yansi-depth-trigger="chat"
          data-yansi-title-authority="canonical"
          aria-label={`${title} — sohbete gir`}
          onClick={onOpenChat}
        >
          {title}
        </button>
        {node.artifact.parentSlug ? (
          <AynaParentLineageRow
            parentAuthorDisplayName={node.parentAuthorDisplayName}
            parentPublicTitle={node.parentPublicTitle}
            onOpenParent={() =>
              router.push(
                buildYansiPublicHref(node.artifact.parentSlug!, { mode: 'reel' })
              )
            }
          />
        ) : null}
        <div className="yansi-desktop-detail-cluster" data-testid="yansi-desktop-detail-cluster">
          <div className="yansi-desktop-proof-row" data-testid="yansi-desktop-proof-row">
            <YansiPublicMetricsLine
              slug={node.artifact.slug}
              journeyVersion={node.artifact.journeyVersion}
              variant="section"
            />
            {summary && role === 'current' ? (
              <button
                type="button"
                className="yansi-desktop-detail-toggle"
                data-testid="yansi-desktop-detail-toggle"
                aria-expanded={detailOpen}
                aria-controls="yansi-desktop-canonical-summary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDetailToggle?.();
                }}
              >
                {detailOpen ? YANSI_DETAIL_CLOSE : YANSI_DETAIL_OPEN}
              </button>
            ) : null}
          </div>
          {summary && role === 'current' ? (
            <div
              className="yansi-desktop-summary-slot"
              data-testid="yansi-desktop-summary-slot"
              data-open={detailOpen ? 'true' : 'false'}
              aria-hidden={detailOpen ? undefined : true}
            >
              <div className="yansi-desktop-summary-slot__inner">
                <p
                  id="yansi-desktop-canonical-summary"
                  className="yansi-desktop-canonical-summary"
                  data-testid="yansi-desktop-canonical-summary"
                  onClick={(event) => event.stopPropagation()}
                >
                  {summary}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </header>
      {rail}
    </div>
  );
}
