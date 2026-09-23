'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import AynaJourneySlide, {
  type AynaJourneySlideActions,
} from '@/components/mirror/ayna/AynaJourneySlide';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  artifactMatchesYansiIdentity,
  buildYansiSourceIdentity,
  type YansiArtifactIdentity,
} from '@/lib/eza/mirror/journey/yansiSidebarIdentity';

export type AynaJourneyReelProps = {
  artifacts: MirrorJourneyArtifact[];
  actions: AynaJourneySlideActions;
  publishBusyJourneyId?: string | null;
  shareBusyJourneyId?: string | null;
  canShare?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  /** Explicit selection from sidebar/route — not IntersectionObserver-only. */
  selectedArtifactIdentity?: YansiArtifactIdentity | null;
  /** Called when the visible slide changes — presentation only, not identity authority. */
  onVisibleArtifactChange?: (artifact: MirrorJourneyArtifact | null) => void;
  /** Mobile Ayna sheet: compact READY product hierarchy. Desktop stays false. */
  compactPrimaryProduct?: boolean;
};

/**
 * Vertical multi-Yansı reel — one artifact per viewport snap.
 * Desktop panel and mobile share this component; only geometry CSS differs.
 */
export default function AynaJourneyReel({
  artifacts,
  actions,
  publishBusyJourneyId = null,
  shareBusyJourneyId = null,
  canShare = true,
  emptyState = null,
  className,
  selectedArtifactIdentity = null,
  onVisibleArtifactChange,
  compactPrimaryProduct = false,
}: AynaJourneyReelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  const keyOf = useCallback(
    (a: MirrorJourneyArtifact) =>
      buildYansiSourceIdentity(a.journeyId, a.journeyVersion) ||
      `${a.journeyId}::v${a.journeyVersion}`,
    []
  );

  const selectedKey = selectedArtifactIdentity
    ? buildYansiSourceIdentity(
        selectedArtifactIdentity.journeyId,
        selectedArtifactIdentity.journeyVersion
      )
    : null;

  // Explicit selection: scroll into view and mark visible.
  useEffect(() => {
    if (!selectedKey || !rootRef.current || artifacts.length === 0) return;
    const match = artifacts.find((a) =>
      artifactMatchesYansiIdentity(a, selectedArtifactIdentity)
    );
    if (!match) return;
    const key = keyOf(match);
    setVisibleKey(key);
    onVisibleArtifactChange?.(match);
    const el = rootRef.current.querySelector<HTMLElement>(
      `[data-journey-id="${match.journeyId}"][data-journey-version="${match.journeyVersion}"]`
    );
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [
    selectedKey,
    selectedArtifactIdentity,
    artifacts,
    keyOf,
    onVisibleArtifactChange,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || artifacts.length === 0) {
      onVisibleArtifactChange?.(null);
      return;
    }

    const slides = Array.from(
      root.querySelectorAll<HTMLElement>('[data-testid="ayna-journey-slide"]')
    );
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Explicit URL/sidebar selection owns active identity — do not let IO steal it.
        if (selectedKey) return;
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best?.target) return;
        const journeyId = best.target.getAttribute('data-journey-id');
        const version = best.target.getAttribute('data-journey-version');
        if (!journeyId || !version) return;
        const key = `${journeyId}::v${version}`;
        setVisibleKey((prev) => (prev === key ? prev : key));
        const match = artifacts.find(
          (a) => a.journeyId === journeyId && String(a.journeyVersion) === version
        );
        if (match) onVisibleArtifactChange?.(match);
      },
      {
        root,
        threshold: [0.45, 0.6, 0.75],
      }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [artifacts, onVisibleArtifactChange, selectedKey]);

  if (artifacts.length === 0) {
    return (
      <div
        className={cn('ayna-journey-reel ayna-journey-reel--empty', className)}
        data-testid="ayna-journey-reel-empty"
      >
        {emptyState}
      </div>
    );
  }

  const activeKey = selectedKey || visibleKey;

  return (
    <div
      ref={rootRef}
      className={cn('ayna-journey-reel', className)}
      data-testid="ayna-journey-reel"
      data-selected-yansi={selectedKey || undefined}
      role="feed"
      aria-label="Bu sohbetten oluşan Yansılar"
    >
      {artifacts.map((artifact, index) => {
        const key = keyOf(artifact);
        return (
          <AynaJourneySlide
            key={key}
            artifact={artifact}
            actions={actions}
            publishBusy={publishBusyJourneyId === artifact.journeyId}
            shareBusy={shareBusyJourneyId === artifact.journeyId}
            canShare={canShare}
            positionLabel={`${index + 1} / ${artifacts.length}`}
            compactPrimaryProduct={compactPrimaryProduct}
            className={cn(activeKey === key && 'ayna-journey-slide--visible')}
          />
        );
      })}
    </div>
  );
}
