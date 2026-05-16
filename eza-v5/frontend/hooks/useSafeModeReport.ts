'use client';

import useSWR from 'swr';
import { getSafeModeReport } from '@/api/safemode';
import type { SafeModeReport, SafeModeReportPeriod } from '@/lib/types/safemode';

export function useSafeModeReport(period: SafeModeReportPeriod = 'weekly', enabled = true) {
  return useSWR<SafeModeReport>(
    enabled ? ['safemode-me-report', period] : null,
    () => getSafeModeReport(period),
    { revalidateOnFocus: false }
  );
}
