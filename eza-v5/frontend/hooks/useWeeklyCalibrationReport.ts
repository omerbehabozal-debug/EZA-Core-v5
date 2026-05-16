'use client';

import useSWR from 'swr';
import { getWeeklyCalibrationReport } from '@/api/governance';
import type { WeeklyCalibrationReport } from '@/lib/types/governance';

export function useWeeklyCalibrationReport(orgId: string | null, weeks = 1) {
  return useSWR<WeeklyCalibrationReport>(
    orgId ? ['weekly-calibration', orgId, weeks] : null,
    () => getWeeklyCalibrationReport(orgId!, weeks),
    { revalidateOnFocus: false }
  );
}
