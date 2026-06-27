/**
 * Internal analytics — seed start (UI never shows "seed").
 */

const SEED_START_EVENT = 'saina:mirror-sohbet-start';

export function trackSeedStart(mirrorSlug: string): void {
  if (typeof window === 'undefined') return;
  const key = `saina_seed_start:${mirrorSlug}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');

  window.dispatchEvent(
    new CustomEvent(SEED_START_EVENT, {
      detail: { mirrorSlug, at: new Date().toISOString() },
    })
  );

  if (process.env.NODE_ENV === 'development') {
    console.info('[SAINA] sohbet start', { mirrorSlug });
  }
}

export { SEED_START_EVENT };
