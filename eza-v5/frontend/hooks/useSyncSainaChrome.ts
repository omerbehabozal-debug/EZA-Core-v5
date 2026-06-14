'use client';

import { useLayoutEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';

/** Registers sidebar/topbar state before paint so route changes keep chrome stable. */
export function useSyncSainaChrome(state: Partial<SainaChromeState>) {
  const setChrome = useSainaChromeStore((s) => s.setChrome);
  const prevRef = useRef<Partial<SainaChromeState> | null>(null);

  useLayoutEffect(() => {
    if (prevRef.current !== null && shallow(prevRef.current, state)) {
      return;
    }
    prevRef.current = state;
    setChrome(state);
  });
}
