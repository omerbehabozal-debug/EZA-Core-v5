/**
 * Project READY/published Journey artifacts into sidebar Yansı rows.
 * Does not mutate conversation rows; does not use conversationSceneUrl.
 */

import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { isReusablePreparedYansiArtifact } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import {
  buildYansiSidebarItemId,
  buildYansiSourceIdentity,
} from '@/lib/eza/mirror/journey/yansiSidebarIdentity';
import {
  formatSainaConversationTime,
  thumbGradientForChatId,
  type SainaConversationItem,
} from '@/lib/eza/sainaConversationList';
import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import { SAINA_EMPTY_CHAT_PREVIEW } from '@/lib/eza/sainaCopy';
import type { ConversationTreeChatItem } from '@/lib/eza/conversation-tree/types';
import type { ConversationTreeGroupNode } from '@/lib/eza/conversation-tree/types';

function canonicalYansiTitle(artifact: MirrorJourneyArtifact): string {
  return (
    artifact.sealedPublicLanding?.publicTitle?.trim() ||
    artifact.publicTitle?.trim() ||
    'Yansı'
  );
}

function canonicalYansiSummary(artifact: MirrorJourneyArtifact): string {
  return (
    artifact.sealedPublicLanding?.publicSummary?.trim() ||
    artifact.publicSummary?.trim() ||
    SAINA_EMPTY_CHAT_PREVIEW
  );
}

function canonicalYansiScene(artifact: MirrorJourneyArtifact): string | null {
  const url = artifact.sceneImageUrl?.trim() || '';
  if (!url) return null;
  if (isConversationSceneDisplayUrl(url)) return url;
  // Allow absolute CDN URLs that are not yet classified as conversation-display.
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

/** Same order as listJourneyArtifactsForConversation. */
export function sortArtifactsForSidebarProjection(
  artifacts: readonly MirrorJourneyArtifact[]
): MirrorJourneyArtifact[] {
  return [...artifacts].sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    if (a.journeyVersion !== b.journeyVersion) {
      return a.journeyVersion - b.journeyVersion;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function projectReadyYansiSidebarItems(
  artifacts: readonly MirrorJourneyArtifact[]
): SainaConversationItem[] {
  const reusable = artifacts.filter(isReusablePreparedYansiArtifact);
  const sorted = sortArtifactsForSidebarProjection(reusable);
  const out: SainaConversationItem[] = [];
  for (const artifact of sorted) {
    const sourceConversationId = artifact.sourceConversationId.trim();
    if (!sourceConversationId) continue;
    const id = buildYansiSidebarItemId({
      sourceConversationId,
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
    });
    if (!id) continue;
    const title = canonicalYansiTitle(artifact);
    const summary = canonicalYansiSummary(artifact);
    const scene = canonicalYansiScene(artifact);
    const savedAt = artifact.updatedAt || artifact.createdAt;
    out.push({
      id,
      kind: 'yansi',
      sourceConversationId,
      journeyId: artifact.journeyId.trim().toLowerCase(),
      journeyVersion: artifact.journeyVersion,
      yansiSourceIdentity: buildYansiSourceIdentity(
        artifact.journeyId,
        artifact.journeyVersion
      ),
      title,
      preview: summary,
      time: formatSainaConversationTime(savedAt),
      savedAt,
      thumbGradient: thumbGradientForChatId(id),
      thumbImageUrl: scene,
      yansiStatus: artifact.status === 'published' ? 'published' : 'ready',
      isMirrorSource: false,
    });
  }
  return out;
}

function toTreeChatItemFromSidebar(
  item: SainaConversationItem
): ConversationTreeChatItem {
  return {
    id: item.id,
    kind: item.kind ?? 'conversation',
    sourceConversationId: item.sourceConversationId,
    journeyId: item.journeyId,
    journeyVersion: item.journeyVersion,
    yansiSourceIdentity: item.yansiSourceIdentity,
    title: item.title,
    preview: item.preview,
    time: item.time,
    thumbGradient: item.thumbGradient,
    thumbImageUrl: item.thumbImageUrl ?? null,
    savedAt: item.savedAt || new Date(0).toISOString(),
    isMirrorSource: Boolean(item.isMirrorSource),
    yansiStatus: item.yansiStatus,
  };
}

/**
 * Flat list: keep conversation order; append each conversation's Yansı
 * immediately after that conversation (Journey order).
 */
export function mergeFlatSidebarWithYansiItems(
  conversations: SainaConversationItem[],
  yansiItems: SainaConversationItem[]
): SainaConversationItem[] {
  const byConv = new Map<string, SainaConversationItem[]>();
  for (const item of yansiItems) {
    if (item.kind !== 'yansi') continue;
    const conv = (item.sourceConversationId || '').trim();
    if (!conv) continue;
    const list = byConv.get(conv) ?? [];
    list.push(item);
    byConv.set(conv, list);
  }
  const out: SainaConversationItem[] = [];
  const seenConv = new Set<string>();
  for (const conv of conversations) {
    const kind = conv.kind ?? 'conversation';
    if (kind === 'yansi') {
      out.push(conv);
      continue;
    }
    out.push({ ...conv, kind: 'conversation' });
    seenConv.add(conv.id);
    const kids = byConv.get(conv.id) ?? [];
    out.push(...kids);
  }
  // Orphan Yansı whose source conversation is not in the list — still show.
  for (const [convId, kids] of Array.from(byConv.entries())) {
    if (seenConv.has(convId)) continue;
    out.push(...kids);
  }
  return out;
}

/**
 * Inject Yansı rows into the same group as their source conversation.
 * Does not create groups. Does not convert Yansı into conversations for actions.
 */
export function injectYansiItemsIntoConversationTree(
  tree: ConversationTreeGroupNode[],
  yansiItems: SainaConversationItem[],
  conversationGroupById: Record<string, string | null | undefined>
): ConversationTreeGroupNode[] {
  if (yansiItems.length === 0) return tree;

  const yansiByConv = new Map<string, ConversationTreeChatItem[]>();
  for (const item of yansiItems) {
    if (item.kind !== 'yansi') continue;
    const conv = (item.sourceConversationId || '').trim();
    if (!conv) continue;
    const list = yansiByConv.get(conv) ?? [];
    list.push(toTreeChatItemFromSidebar(item));
    yansiByConv.set(conv, list);
  }

  const used = new Set<string>();

  const injectIntoList = (
    chats: ConversationTreeChatItem[]
  ): ConversationTreeChatItem[] => {
    const out: ConversationTreeChatItem[] = [];
    for (const chat of chats) {
      if (chat.kind === 'yansi') {
        out.push(chat);
        continue;
      }
      out.push({ ...chat, kind: chat.kind ?? 'conversation' });
      const kids = yansiByConv.get(chat.id);
      if (kids?.length) {
        out.push(...kids);
        used.add(chat.id);
      }
    }
    return out;
  };

  const next = tree.map((group) => ({
    ...group,
    conversations: injectIntoList(group.conversations),
  }));

  // Place orphans into the group of their source conversation when known.
  for (const [convId, kids] of Array.from(yansiByConv.entries())) {
    if (used.has(convId)) continue;
    const groupId = (conversationGroupById[convId] || '').trim();
    if (groupId) {
      const idx = next.findIndex((g) => g.id === groupId);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx]!,
          conversations: [...next[idx]!.conversations, ...kids],
        };
        used.add(convId);
        continue;
      }
    }
    // Fallback: append to last / ungrouped node if present, else first node.
    const ungroupedIdx = next.findIndex((g) => g.id === '__ungrouped__');
    const target = ungroupedIdx >= 0 ? ungroupedIdx : next.length - 1;
    if (target >= 0 && next[target]) {
      next[target] = {
        ...next[target]!,
        conversations: [...next[target]!.conversations, ...kids],
      };
    }
  }

  return next;
}
