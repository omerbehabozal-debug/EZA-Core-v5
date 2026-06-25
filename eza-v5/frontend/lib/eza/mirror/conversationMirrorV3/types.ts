/**
 * SAINA Conversation Mirror V3 — final cinematic poster pipeline.
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import type { SceneComposition } from '@/lib/eza/mirror/conversationMirrorV3/sceneCompositionV4';

export const MIRROR_PIPELINE_VERSION = 'v3' as const;
export const MIRROR_REFINEMENT_VERSION = '5.0' as const;

/** Scene + client cache bust — bump on V3 contract changes. */
export const MIRROR_V3_SCENE_CACHE_KEY = 'conversationMirrorV3:refinement:5.0' as const;

export const MIRROR_V3_BRAND_SIGNATURE = {
  line1: 'SAINA',
  line2: 'İlişkiyi dinler, deseni zamanla görür.',
} as const;

import type { MirrorCuriosityBundle } from '@/lib/eza/mirror-network/types';

export type SainaMirrorV3Payload = SainaMirrorPayload & {
  pipelineVersion: 'v3';
  refinementVersion: '5.0';
  /** Primary story topic for shot mode and editorial copy (V4.3). */
  storyTopicId: StoryTopicId;
  /** Concrete visual traces from active conversation (V4). */
  conversationEvidence: ConversationEvidence[];
  /** Evidence-first hero scene composition (V4). */
  sceneComposition: SceneComposition;
  /** Topic → meaning layer (emotional essence, not literal subject). */
  meaning: string;
  /** Narrative theme label for art direction. */
  narrativeTheme: string;
  /** Emotion label from tone mapping. */
  emotion: string;
  /** Narrative distance level (2–3): cinematic interpretation, not summary. */
  narrativeDistance: 2 | 3;
  narrativeDistanceLabel: string;
  /** Atmosphere string passed to OpenAI (abstract, non-literal). */
  emotionalAtmosphere: string;
  /** Stage 0 — landing/seed only; never on card or image prompt. */
  curiosityBundle?: MirrorCuriosityBundle;
};
