'use client';

import useSWR from 'swr';
import { getAdminEventDetail, listAdminEvents } from '@/api/governance';
import type { EventDetail, EventsListResponse, ListEventsParams } from '@/lib/types/governance';

export function useAdminEvents(orgId: string | null, params: ListEventsParams) {
  const key = orgId
    ? [
        'admin-events',
        orgId,
        params.days,
        params.limit,
        params.source_mode,
        params.event_type,
        params.user_id,
      ]
    : null;

  return useSWR<EventsListResponse>(
    key,
    () => listAdminEvents(orgId!, params),
    { revalidateOnFocus: false }
  );
}

export function useAdminEventDetail(orgId: string | null, eventId: string | null) {
  return useSWR<EventDetail>(
    orgId && eventId ? ['admin-event-detail', orgId, eventId] : null,
    () => getAdminEventDetail(orgId!, eventId!),
    { revalidateOnFocus: false }
  );
}
