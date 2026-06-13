'use client';

import { useEffect } from 'react';

/** Meta+K / Ctrl+K — opens SAINA command palette (standard palette shortcut). */
export function useSainaCommandShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

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
