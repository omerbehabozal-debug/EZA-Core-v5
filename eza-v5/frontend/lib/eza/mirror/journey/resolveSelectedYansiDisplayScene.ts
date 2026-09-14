/**
 * Artifact-scoped display scene for explicit ?yansi= selection.
 * Display-only — never writes archive / conversationSceneUrl.
 */

import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import { listJourneyArtifactsForConversation } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { isReusablePreparedYansiArtifact } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import {
  artifactMatchesYansiIdentity,
  type YansiArtifactIdentity,
} from '@/lib/eza/mirror/journey/yansiSidebarIdentity';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';

/**
 * Resolve the exact READY/published artifact for an explicit route identity.
 * No "latest" fallback when identity is set but missing.
 */
export function resolveSelectedYansiArtifact(input: {
  ownerUserId: string | null | undefined;
  sourceConversationId: string | null | undefined;
  identity: YansiArtifactIdentity | null | undefined;
  artifacts?: readonly MirrorJourneyArtifact[];
}): MirrorJourneyArtifact | null {
  const conv = (input.sourceConversationId || '').trim();
  const owner = (input.ownerUserId || '').trim();
  const identity = input.identity;
  if (!conv || !identity) return null;

  const artifacts =
    input.artifacts ??
    (owner ? listJourneyArtifactsForConversation(owner, conv) : []);

  const match = artifacts.find(
    (a) =>
      a.sourceConversationId.trim() === conv &&
      artifactMatchesYansiIdentity(a, identity) &&
      isReusablePreparedYansiArtifact(a)
  );
  return match ?? null;
}

/** Persistable scene URL for chrome display override, or null. */
export function resolveSelectedYansiDisplaySceneUrl(input: {
  ownerUserId: string | null | undefined;
  sourceConversationId: string | null | undefined;
  identity: YansiArtifactIdentity | null | undefined;
  artifacts?: readonly MirrorJourneyArtifact[];
}): string | null {
  const artifact = resolveSelectedYansiArtifact(input);
  const url = artifact?.sceneImageUrl?.trim() || '';
  if (!url || !isConversationSceneDisplayUrl(url)) return null;
  return url;
}

/**
 * Visible chrome scene: selected Yansı override wins over conversation scene.
 * Does not mutate either source.
 */
export function resolveChromeDisplaySceneUrl(
  conversationSceneUrl: string | null | undefined,
  selectedYansiSceneUrl: string | null | undefined
): string | null {
  const override = (selectedYansiSceneUrl || '').trim();
  if (override && isConversationSceneDisplayUrl(override)) return override;
  const conv = (conversationSceneUrl || '').trim();
  return conv && isConversationSceneDisplayUrl(conv) ? conv : null;
}
