'use client';

import { useLayoutEffect, useRef } from 'react';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';

/** Registers sidebar/topbar state before paint so route changes keep chrome stable. */
export function useSyncSainaChrome(state: Partial<SainaChromeState>) {
  const setChrome = useSainaChromeStore((s) => s.setChrome);
  const stateRef = useRef(state);
  stateRef.current = state;

  useLayoutEffect(() => {
    setChrome(stateRef.current);
  });
}
