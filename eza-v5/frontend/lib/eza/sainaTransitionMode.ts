export type SainaTransitionMode = 'glass' | 'opacity';

function isOperaBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /OPR\/|Opera Mini/i.test(navigator.userAgent);
}

function supportsFilterBlur(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  try {
    return CSS.supports('filter', 'blur(2px)');
  } catch {
    return false;
  }
}

/** Glass blur is skipped on engines where animated filter crashes or stutters (e.g. Opera). */
export function resolveSainaTransitionMode(): SainaTransitionMode {
  if (typeof window === 'undefined') return 'opacity';

  if (process.env.VITEST === 'true') return 'opacity';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'opacity';
  }

  if (isOperaBrowser() || !supportsFilterBlur()) {
    return 'opacity';
  }

  return 'glass';
}
