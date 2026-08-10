'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import AynaJourneySlide, {
  type AynaJourneySlideActions,
} from '@/components/mirror/ayna/AynaJourneySlide';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';

export type AynaJourneyReelProps = {
  artifacts: MirrorJourneyArtifact[];
  actions: AynaJourneySlideActions;
  publishBusyJourneyId?: string | null;
  shareBusyJourneyId?: string | null;
  canShare?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  /** Called when the visible slide changes — presentation only, not identity authority. */
  onVisibleArtifactChange?: (artifact: MirrorJourneyArtifact | null) => void;
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
  onVisibleArtifactChange,
}: AynaJourneyReelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  const keyOf = useCallback(
    (a: MirrorJourneyArtifact) => `${a.journeyId}::v${a.journeyVersion}`,
    []
  );

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
  }, [artifacts, onVisibleArtifactChange]);

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

  return (
    <div
      ref={rootRef}
      className={cn('ayna-journey-reel', className)}
      data-testid="ayna-journey-reel"
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
            className={cn(
              visibleKey === key && 'ayna-journey-slide--visible'
            )}
          />
        );
      })}
    </div>
  );
}
