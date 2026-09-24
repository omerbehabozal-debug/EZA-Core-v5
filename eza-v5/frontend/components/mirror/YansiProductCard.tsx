'use client';

import type { ReactNode, Ref } from 'react';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';

export type YansiProductCardProps = {
  title: string;
  summary?: string | null;
  sceneImageUrl?: string | null;
  className?: string;
  testIdPrefix?: string;
  slug?: string;
  loadingLazy?: boolean;
  /** Ayna-only expand; not part of published Discover product chrome. */
  onOpenFullscreen?: () => void;
  expandLabel?: string;
  captureRef?: Ref<HTMLElement>;
  /**
   * Discover / network context rendered around the product core
   * (identity, metrics, CTA) — never publication management.
   */
  kicker?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
};

/**
 * Canonical Yansı product presentation: visual → title → summary.
 * Shared by Ayna publication preview and Discover published cards.
 * Surface-specific controls stay in kicker / meta / footer (or outside).
 */
export default function YansiProductCard({
  title,
  summary,
  sceneImageUrl,
  className,
  testIdPrefix = 'yansi-product-card',
  slug,
  loadingLazy = false,
  onOpenFullscreen,
  expandLabel,
  captureRef,
  kicker,
  meta,
  footer,
}: YansiProductCardProps) {
  return (
    <MirrorPublicCard
      title={title}
      summary={summary}
      sceneImageUrl={sceneImageUrl}
      metaLabel={null}
      className={className}
      testIdPrefix={testIdPrefix}
      slug={slug}
      loadingLazy={loadingLazy}
      onOpenFullscreen={onOpenFullscreen}
      expandLabel={expandLabel}
      captureRef={captureRef}
      kicker={kicker}
      meta={meta}
      footer={footer}
      canonicalProduct
    />
  );
}
