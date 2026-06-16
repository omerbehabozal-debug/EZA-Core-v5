export type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
export {
  MIRROR_PIPELINE_VERSION as MIRROR_V3_PIPELINE_VERSION,
  MIRROR_REFINEMENT_VERSION,
  MIRROR_V3_SCENE_CACHE_KEY,
  MIRROR_V3_BRAND_SIGNATURE,
} from '@/lib/eza/mirror/conversationMirrorV3/types';

export {
  buildMirrorV3IntentFingerprint,
  buildMirrorV3SeedHint,
} from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';

export { resolveNarrativeLayer } from '@/lib/eza/mirror/conversationMirrorV3/narrativeLayer';
export { resolveNarrativeDistance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
export { resolveMeaningMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV3/meaningMirrorCopy';
export {
  hasConversationSummaryLanguage,
  containsDirectTopicReference,
  sanitizeNarrativeMirrorCopy,
  polishNarrativeMirrorText,
} from '@/lib/eza/mirror/conversationMirrorV3/narrativeCopySanitizer';
export {
  FORBIDDEN_MIRROR_PHRASES,
  FORBIDDEN_MIRROR_CONCEPTS,
  containsForbiddenMirrorPhrase,
} from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';

export { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
export {
  buildMirrorV3ImagePrompt,
  MIRROR_V3_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
export { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
export { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';

export {
  applyV3PosterBrandOverlayUrl,
  resolveV3SceneDisplayUrl,
  isV3MirrorCard,
} from '@/lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay';
