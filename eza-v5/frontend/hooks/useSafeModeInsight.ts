'use client';

import useSWR from 'swr';
import { getSafeModeInsight } from '@/api/safemode';
import type { SafeModeInsight } from '@/lib/types/safemode';

export function useSafeModeInsight(enabled = true) {
  return useSWR<SafeModeInsight>(enabled ? 'safemode-me-insight' : null, getSafeModeInsight, {
    revalidateOnFocus: false,
  });
}
