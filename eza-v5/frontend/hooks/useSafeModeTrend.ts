'use client';

import useSWR from 'swr';
import { getSafeModeTrend } from '@/api/safemode';
import type { SafeModeTrend } from '@/lib/types/safemode';

export function useSafeModeTrend(enabled = true) {
  return useSWR<SafeModeTrend>(enabled ? 'safemode-me-trend' : null, getSafeModeTrend, {
    revalidateOnFocus: false,
  });
}
