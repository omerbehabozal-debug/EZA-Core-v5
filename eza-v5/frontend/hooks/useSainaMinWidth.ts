'use client';

import { useEffect, useState } from 'react';
import { SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';

export function useSainaMinWidth(minWidth: number) {
  const [matches, setMatches] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [minWidth]);

  return matches;
}

/** Tablet + desktop shell (sidebar visible, no drawer). */
export function useSainaCompactShell() {
  return useSainaMinWidth(SAINA_COMPACT_SHELL_MIN_PX);
}
