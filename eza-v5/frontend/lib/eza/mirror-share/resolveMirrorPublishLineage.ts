/**
 * Resolve parent/root mirror lineage for network publish and observation events.
 */

import { getChatArchive } from '@/lib/standaloneChatArchive';

export type MirrorPublishLineage = {
  parentSlug?: string;
  parentMirrorId?: string;
  rootMirrorId?: string;
};

function normalizeSlug(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveMirrorPublishLineage(input: {
  conversationId?: string | null;
  curiosityLineage?: string | null;
  currentMirrorId?: string | null;
}): MirrorPublishLineage {
  const chat = input.conversationId ? getChatArchive(input.conversationId) : null;
  const origin = chat?.mirrorOrigin;
  const tree = chat?.treeMetadata;

  const parentSlug =
    normalizeSlug(origin?.startedFromMirrorId) ??
    normalizeSlug(tree?.startedFromMirrorId) ??
    normalizeSlug(tree?.parentMirrorId) ??
    normalizeSlug(input.curiosityLineage) ??
    undefined;

  const parentMirrorId =
    normalizeSlug(origin?.parentMirrorId) ??
    normalizeSlug(tree?.parentMirrorId) ??
    parentSlug;

  const rootMirrorId =
    normalizeSlug(origin?.rootMirrorId) ??
    normalizeSlug(tree?.rootMirrorId) ??
    parentSlug ??
    normalizeSlug(input.currentMirrorId) ??
    undefined;

  return { parentSlug, parentMirrorId, rootMirrorId };
}
