'use client';

import { useEffect } from 'react';

/**
 * Phase 8.7 — keep composer/controls above the on-screen keyboard.
 * Sets `--saina-keyboard-inset` from visualViewport (0 when unsupported).
 */
export function useSainaVisualViewportInset(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const vv = window.visualViewport;

    const sync = () => {
      if (!vv) {
        root.style.setProperty('--saina-keyboard-inset', '0px');
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--saina-keyboard-inset', `${Math.round(inset)}px`);
    };

    sync();
    if (!vv) return;
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
      root.style.removeProperty('--saina-keyboard-inset');
    };
  }, []);
}
