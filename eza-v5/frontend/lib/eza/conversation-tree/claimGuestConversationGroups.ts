/**
 * Sync guest conversation groups to authenticated user on backend.
 */

import { apiClient } from '@/lib/apiClient';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { trackGuestTreeClaimed } from '@/lib/eza/conversation-tree/conversationTreeAnalytics';

export type ClaimGuestConversationGroupsResponse = {
  claimed: ConversationGroup[];
  merged: number;
};

export async function claimGuestConversationGroups(
  guestToken: string
): Promise<ClaimGuestConversationGroupsResponse> {
  const response = await apiClient.post<ClaimGuestConversationGroupsResponse>(
    '/api/conversation-groups/claim-guest',
    {
      body: { guestToken },
      auth: true,
    }
  );

  if (!response.ok) {
    const message =
      response.error?.error_message ||
      response.error?.message ||
      'claim_guest_failed';
    throw new Error(message);
  }

  const data = response.data ?? { claimed: [], merged: 0 };
  if (data.claimed.length > 0 || data.merged > 0) {
    trackGuestTreeClaimed(data.claimed.length + data.merged);
  }
  return data;
}
