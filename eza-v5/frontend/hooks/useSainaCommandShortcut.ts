'use client';

import { useEffect } from 'react';
import { SAINA_SEARCH_ENABLED } from '@/lib/eza/sainaSearchAvailability';

/** Meta+K / Ctrl+K — opens SAINA command palette (standard palette shortcut). */
export function useSainaCommandShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !SAINA_SEARCH_ENABLED) return;

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onOpen();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen, enabled]);
}
