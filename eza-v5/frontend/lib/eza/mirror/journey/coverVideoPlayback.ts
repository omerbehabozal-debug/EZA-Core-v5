import { useEffect, useRef, type SyntheticEvent } from 'react';
import { releaseCoverVideo } from '@/lib/eza/mirror/journey/businessMedia';

/**
 * One playback generation per source. Cleanup never rewinds the counter,
 * so a late play() rejection cannot match the next video's session.
 */
export function useCoverVideoPlayback(
  play: boolean,
  source: string | null,
  onPlaybackFailed: () => void
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const counter = useRef(0);
  const current = useRef(-1);
  const fail = useRef(onPlaybackFailed);
  fail.current = onPlaybackFailed;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !play || !source) return;
    const mine = ++counter.current;
    current.current = mine;
    el.dataset.coverSession = String(mine);
    el.muted = true;
    const pending = el.play();
    if (pending && typeof pending.then === 'function') {
      pending.catch(() => {
        if (current.current === mine) fail.current();
      });
    }
    return () => {
      if (current.current === mine) current.current = -1;
      releaseCoverVideo(el);
    };
  }, [play, source]);

  const onError = (event: SyntheticEvent<HTMLVideoElement>) => {
    const mine = Number(event.currentTarget.dataset.coverSession || '0');
    if (mine > 0 && current.current === mine) fail.current();
  };

  return { videoRef, onError };
}
