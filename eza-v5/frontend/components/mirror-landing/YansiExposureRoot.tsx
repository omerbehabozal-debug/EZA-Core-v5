'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import {
  evaluateYansiExposureWindow,
  isDocumentVisibleForExposure,
  trackYansiExposure,
  type YansiExposureContext,
  YANSI_EXPOSURE_MIN_DWELL_MS,
  YANSI_EXPOSURE_MIN_RATIO,
} from '@/lib/eza/mirror-network/yansiExposure';

type Props = {
  slug: string;
  journeyVersion?: number | null;
  context: YansiExposureContext;
  children: ReactNode;
};

export default function YansiExposureRoot({
  slug,
  journeyVersion,
  context,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof journeyVersion !== 'number' || journeyVersion < 1) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let dwellStartedAt: number | null = null;
    let timer: number | null = null;
    let stopped = false;

    const cancel = () => {
      dwellStartedAt = null;
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const maybeCount = (ratio: number) => {
      if (stopped) return;
      const hidden = !isDocumentVisibleForExposure();
      const dwellMs =
        dwellStartedAt == null ? 0 : Math.max(0, Date.now() - dwellStartedAt);
      const verdict = evaluateYansiExposureWindow({
        intersectionRatio: ratio,
        documentHidden: hidden,
        dwellMs,
      });
      if (verdict === 'count') {
        cancel();
        stopped = true;
        trackYansiExposure({ slug, journeyVersion, context });
        return;
      }
      if (verdict === 'ignore') {
        cancel();
        return;
      }
      if (dwellStartedAt == null) {
        dwellStartedAt = Date.now();
      }
      if (timer == null) {
        timer = window.setTimeout(() => maybeCount(ratio), YANSI_EXPOSURE_MIN_DWELL_MS);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        maybeCount(entry.intersectionRatio);
      },
      { threshold: [YANSI_EXPOSURE_MIN_RATIO] }
    );
    observer.observe(el);

    const onVisibility = () => {
      if (!isDocumentVisibleForExposure()) cancel();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cancel();
    };
  }, [slug, journeyVersion, context]);

  return (
    <div ref={ref} data-yansi-exposure-root={context}>
      {children}
    </div>
  );
}
