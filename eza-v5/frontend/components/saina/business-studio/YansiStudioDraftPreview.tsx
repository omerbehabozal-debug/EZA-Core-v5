'use client';

/**
 * Studio draft preview — reuses public Keşfet / Deneyimle presentation primitives
 * without analytics, navigation, publish, or continuation AI.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import BusinessMediaBlocks from '@/components/mirror-landing/BusinessMediaBlocks';
import SainaDesktopChatLayout from '@/components/saina/SainaDesktopChatLayout';
import MessageList, { type MessageListMessage } from '@/components/standalone/MessageList';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import { fetchBrandAssetPreview } from '@/lib/eza/businessYansi';
import {
  SAINA_DISCOVER_OPEN_CTA,
  SAINA_DISCOVER_OPEN_CTA_SHORT,
} from '@/lib/eza/mirror-network/discoverCopy';
import { DEFAULT_YANSI_READING } from '@/lib/eza/mirror/yansiReadingPreferences';
import type { YansiV2ConversationPreview } from '@/lib/eza/yansiV2ConversationCreate';
import '@/styles/saina-my-page.css';
import '@/styles/yansi-reel-responsive.css';

export type YansiStudioDraftPreviewMode = 'discover' | 'experience';

type Props = {
  mode: YansiStudioDraftPreviewMode;
  businessId: string;
  brandName?: string | null;
  preview: YansiV2ConversationPreview;
  coverAssetId?: string | null;
  /** Parallel to preview.turns — image asset id per turn (optional). */
  turnMediaAssetIds?: Array<string | null | undefined>;
  /**
   * QA / local fixture: when set, skips authenticated asset fetch.
   * Production Studio continues to use coverAssetId + fetchBrandAssetPreview.
   */
  fixtureCoverUrl?: string | null;
  /** Parallel to turns — fixture image URLs (same index as turnMediaAssetIds). */
  fixtureTurnMediaUrls?: Array<string | null | undefined>;
};

function revokeObjectUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    /* jsdom */
  }
}

function useBrandAssetUrl(businessId: string, assetId: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!assetId) {
      setSrc(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBrandAssetPreview(businessId, assetId, 'original')
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      revokeObjectUrl(revoked);
    };
  }, [businessId, assetId]);
  return src;
}

/** Cover atmosphere — same bleed / plate / overlay stack as public Deneyimle desktop. */
function StudioExperienceScene({ sceneUrl }: { sceneUrl: string | null }) {
  return (
    <div
      className="saina-canvas-bg saina-canvas-bg--default-scene yansi-studio-preview-scene"
      aria-hidden
      data-testid="biz-conv-preview-scene"
      data-yansi-studio-preview-scene={sceneUrl ? 'cover' : 'empty'}
    >
      {sceneUrl ? (
        <div className="yansi-desktop-scene-stack yansi-studio-preview-scene-stack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sceneUrl}
            alt=""
            className="yansi-desktop-scene-bleed"
            data-testid="biz-conv-preview-scene-bleed"
            data-yansi-layer="atmosphere"
          />
          <div className="yansi-desktop-scene-bleed-dim" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sceneUrl}
            alt=""
            className="yansi-desktop-scene-image"
            data-testid="biz-conv-preview-scene-plate"
            data-yansi-plate="sharp"
            data-yansi-brand-cover="true"
          />
        </div>
      ) : null}
      <div className="saina-canvas-overlay saina-canvas-overlay--left" />
      <div className="saina-canvas-overlay saina-canvas-overlay--center" />
      <div className="saina-canvas-overlay saina-canvas-overlay--pattern-dim" />
      <div className="saina-canvas-overlay saina-canvas-overlay--right" />
      <div className="saina-canvas-vignette saina-canvas-vignette--scene" />
      <div className="yansi-chat-scene-veil yansi-chat-scene-veil--active" />
    </div>
  );
}

function TurnMedia({
  assetId,
  title,
  src,
}: {
  assetId: string;
  title: string;
  src: string | null;
}) {
  if (!src) {
    return <p className="biz-card-meta">Medya: {title}</p>;
  }
  return (
    <BusinessMediaBlocks
      blocks={[
        {
          type: 'image',
          assetId,
          title,
          // Placeholder path — imageSrc override is authoritative; never a storage locator.
          contentPath:
            '/api/business-yansi/public-media/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000',
        },
      ]}
      imageSrc={src}
      layout="desktop"
    />
  );
}

/** Studio-only annotation — not part of public Deneyimle chrome. */
function StudioSourcesAnnotation({
  rows,
}: {
  rows: YansiV2ConversationPreview['linkedKnowledge'];
}) {
  if (!rows.length) return null;
  return (
    <aside
      className="biz-conv-preview-sources-studio"
      data-testid="biz-conv-preview-sources"
      aria-label="Bağlı bilgi kaynakları"
    >
      <h4 className="biz-conv-preview-sources-studio__title">Kaynaklar</h4>
      <p className="biz-card-meta">Studio bilgisi · yayınlı Deneyimle ekranında görünmez</p>
      <ul className="biz-conv-preview-sources-studio__list">
        {rows.map((row) => (
          <li key={row.id}>
            {row.title} · {row.aiStatusLabel}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function YansiStudioDraftPreview({
  mode,
  businessId,
  brandName,
  preview,
  coverAssetId,
  turnMediaAssetIds = [],
  fixtureCoverUrl = null,
  fixtureTurnMediaUrls = [],
}: Props) {
  const reading = DEFAULT_YANSI_READING;
  const fetchedCoverUrl = useBrandAssetUrl(
    businessId,
    fixtureCoverUrl ? null : coverAssetId || null,
  );
  const coverUrl = fixtureCoverUrl || fetchedCoverUrl;
  const ids = useMemo(
    () => turnMediaAssetIds.map((id) => (id || '').trim() || null),
    [turnMediaAssetIds],
  );

  const u0 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[0] ? null : ids[0]);
  const u1 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[1] ? null : ids[1]);
  const u2 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[2] ? null : ids[2]);
  const u3 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[3] ? null : ids[3]);
  const u4 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[4] ? null : ids[4]);
  const u5 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[5] ? null : ids[5]);
  const u6 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[6] ? null : ids[6]);
  const u7 = useBrandAssetUrl(businessId, fixtureTurnMediaUrls[7] ? null : ids[7]);
  const mediaSrcByIndex = [
    fixtureTurnMediaUrls[0] || u0,
    fixtureTurnMediaUrls[1] || u1,
    fixtureTurnMediaUrls[2] || u2,
    fixtureTurnMediaUrls[3] || u3,
    fixtureTurnMediaUrls[4] || u4,
    fixtureTurnMediaUrls[5] || u5,
    fixtureTurnMediaUrls[6] || u6,
    fixtureTurnMediaUrls[7] || u7,
  ];

  const threadMessages = useMemo<MessageListMessage[]>(() => {
    return preview.turns.flatMap((turn) => {
      const prefix = `studio-preview:${turn.stepIndex}`;
      return [
        { id: `${prefix}:user`, text: turn.question, isUser: true },
        { id: `${prefix}:assistant`, text: turn.answer, isUser: false },
      ];
    });
  }, [preview.turns]);

  const sources = (
    <StudioSourcesAnnotation rows={preview.linkedKnowledge} />
  );

  if (mode === 'discover') {
    return (
      <div className="biz-conv-preview-stack" data-testid="biz-conv-preview-stack">
        <div className="biz-conv-preview-device" data-testid="biz-conv-preview-discover">
          <YansiProductCard
            title={preview.title}
            summary={preview.curiosityQuestion}
            sceneImageUrl={coverUrl}
            className="saina-discover-card--editorial"
            testIdPrefix="biz-conv-discover-card"
            kicker={
              brandName ? (
                <p className="saina-discover-card__identity" data-testid="biz-conv-preview-brand">
                  {brandName}
                </p>
              ) : null
            }
            footer={
              <div className="saina-discover-card__actions">
                <button
                  type="button"
                  className="saina-discover-card__cta"
                  disabled
                  aria-disabled="true"
                  data-testid="biz-conv-preview-discover-cta"
                  title="Önizleme — canlı Keşfet açılmaz"
                >
                  <span className="saina-discover-card__cta-label">{SAINA_DISCOVER_OPEN_CTA}</span>
                  <span className="saina-discover-card__cta-short" aria-hidden>
                    {SAINA_DISCOVER_OPEN_CTA_SHORT}
                  </span>
                  <span className="saina-discover-card__cta-mobile">Deneyimle</span>
                </button>
              </div>
            }
          />
          <p className="biz-card-meta" data-testid="biz-conv-preview-discover-note">
            Studio önizlemesi · Keşfet feed’e düşmez · tıklama kapalı
          </p>
          {!coverUrl && preview.coverTitle ? (
            <p className="biz-card-meta">Kapak: {preview.coverTitle}</p>
          ) : null}
          <p className="biz-card-meta" data-testid="biz-conv-preview-curiosity">
            Merak sorusu: {preview.curiosityQuestion}
          </p>
        </div>
        {sources}
      </div>
    );
  }

  return (
    <div className="biz-conv-preview-stack" data-testid="biz-conv-preview-stack">
      <div
        className="yansi-desktop-experience saina-main yansi-studio-experience-preview"
        data-testid="biz-conv-preview-experience"
        data-yansi-studio-preview="experience"
        data-reading-mode={reading.mode}
      >
        <StudioExperienceScene sceneUrl={coverUrl} />
        <div className="saina-main-body saina-desktop-chat-layout">
          <SainaDesktopChatLayout
            replay
            header={
              <div data-testid="biz-conv-preview-experience-header">
                <p className="biz-studio-eyebrow">{brandName || 'Yansı'}</p>
                <h3 className="yansi-mobile-experience-title">{preview.title}</h3>
              </div>
            }
            messages={
              <div
                className="yansi-public-reading"
                data-testid="biz-conv-preview-experience-thread"
                data-reading-mode={reading.mode}
                data-reading-spacing={reading.spacing}
                style={
                  {
                    '--yansi-reading-size': `${reading.fontSize}px`,
                  } as CSSProperties
                }
              >
                <div data-testid="biz-conv-preview-turns">
                  <MessageList
                    messages={threadMessages}
                    variant="saina"
                    autoScroll={false}
                    isLoading={false}
                    ezaVisibilityEnabled={false}
                    renderMessageBody={(message) => {
                      if (message.isUser) return undefined;
                      const stepIndex = Number(message.id.split(':')[1]);
                      const turnIndex = preview.turns.findIndex((t) => t.stepIndex === stepIndex);
                      const turn = turnIndex >= 0 ? preview.turns[turnIndex] : null;
                      const mediaId = turnIndex >= 0 ? ids[turnIndex] : null;
                      const mediaSrc = turnIndex >= 0 ? mediaSrcByIndex[turnIndex] || null : null;
                      return (
                        <>
                          <SainaMessageBody message={message.text} role="ai" />
                          {mediaId && turn?.mediaTitle ? (
                            <TurnMedia
                              assetId={mediaId}
                              title={turn.mediaTitle}
                              src={mediaSrc}
                            />
                          ) : turn?.mediaTitle ? (
                            <small>Medya: {turn.mediaTitle}</small>
                          ) : null}
                        </>
                      );
                    }}
                  />
                </div>
              </div>
            }
            action={
              <p className="biz-card-meta" data-testid="biz-conv-preview-experience-note">
                Önizleme · canlı devam sohbeti ve analitik kapalı
              </p>
            }
            composer={
              <div
                className="biz-conv-preview-composer-locked"
                data-testid="biz-conv-preview-composer-locked"
                aria-disabled="true"
              >
                Önizleme — mesaj gönderilemez
              </div>
            }
          />
        </div>
      </div>
      {sources}
    </div>
  );
}
