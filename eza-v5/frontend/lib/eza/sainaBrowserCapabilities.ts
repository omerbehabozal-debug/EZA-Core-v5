export function isOperaBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /OPR\/|Opera Mini/i.test(navigator.userAgent);
}

/** Opera + reduced-motion: skip decorative island/map motion (known compositor crashes). */
export function shouldDisableDecorativeMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  return isOperaBrowser();
}

function supportsFilterBlur(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  try {
    return CSS.supports('filter', 'blur(2px)');
  } catch {
    return false;
  }
}

export type SainaTransitionMode = 'glass' | 'opacity';

/** Glass blur is skipped on engines where animated filter crashes or stutters (e.g. Opera). */
export function resolveSainaTransitionMode(): SainaTransitionMode {
  if (typeof window === 'undefined') return 'opacity';

  if (process.env.VITEST === 'true') return 'opacity';

  if (shouldDisableDecorativeMotion() || !supportsFilterBlur()) {
    return 'opacity';
  }

  return 'glass';
}
