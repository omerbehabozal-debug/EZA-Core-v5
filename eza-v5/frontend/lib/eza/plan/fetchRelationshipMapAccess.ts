/**
 * Fetch server-authoritative relationship map access.
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type { RelationshipMapAccess } from '@/lib/eza/plan/tierEntitlements';

export type RelationshipMapAccessResponse = {
  access: RelationshipMapAccess;
  relationshipMapCutoffIso: string | null;
};

export type RelationshipMapAccessState =
  | { status: 'loading' }
  | { status: 'ready'; access: RelationshipMapAccess; cutoffIso: string | null }
  | { status: 'locked'; access: 'locked'; cutoffIso: null };

export async function fetchRelationshipMapAccess(): Promise<RelationshipMapAccessState> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('eza_token') : null;
  const headers: Record<string, string> = {};
  if (!token && typeof window !== 'undefined') {
    const guestToken = getOrCreateMirrorGuestToken();
    if (guestToken) {
      headers[GUEST_TOKEN_HEADER] = guestToken;
    }
  }

  const res = await apiClient.get<RelationshipMapAccessResponse>(
    '/api/account/relationship-map-access',
    { auth: Boolean(token), headers }
  );

  if (!res.ok) {
    return { status: 'locked', access: 'locked', cutoffIso: null };
  }

  const payload = (res.data ?? res) as RelationshipMapAccessResponse;
  const access = payload.access;
  const cutoffIso = payload.relationshipMapCutoffIso ?? null;

  if (access === 'locked') {
    return { status: 'locked', access: 'locked', cutoffIso: null };
  }

  return { status: 'ready', access, cutoffIso };
}
