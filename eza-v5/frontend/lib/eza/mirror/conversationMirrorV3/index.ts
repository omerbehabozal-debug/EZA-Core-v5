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
export {
  purgeLegacyMirrorSceneCaches,
  isV31SceneCacheFingerprint,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorSceneCacheMigration';
export { MIRROR_V3_STYLE_PRESET } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';

export { resolveConversationEvidence, formatConversationEvidenceBlock } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
export type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
export {
  buildConversationMirrorV4QualityReport,
  meetsConversationMirrorV4QualityTarget,
  shouldRegeneratePromptForTopicVisibility,
  CONVERSATION_MIRROR_V4_TARGET_SCORE,
  buildConversationMirrorV33QualityReport,
  meetsConversationMirrorV33QualityTarget,
  CONVERSATION_MIRROR_V33_TARGET_SCORE,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationMirrorV33Quality';
export type {
  ConversationMirrorV4QualityReport,
  ConversationMirrorV33QualityReport,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationMirrorV33Quality';
export { resolveSceneComposition, formatSceneCompositionBlock } from '@/lib/eza/mirror/conversationMirrorV3/sceneCompositionV4';
export type { SceneComposition } from '@/lib/eza/mirror/conversationMirrorV3/sceneCompositionV4';
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

export { resolveEvidenceFusion, formatEvidenceFusionBlock } from '@/lib/eza/mirror/conversationMirrorV3/evidenceFusionV44';
export type { EvidenceFusion } from '@/lib/eza/mirror/conversationMirrorV3/evidenceFusionV44';
export { resolveTopicShotMode, inferStoryTopicFromEvidence } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';
export type { TopicShotMode } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';
export { resolveEvidenceMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV3/evidenceAwareMirrorCopy';

export { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
export {
  buildMirrorV3ImagePrompt,
  MIRROR_V3_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
export {
  buildMirrorRenderBrief,
  resolvePublicTopicHint,
  resolveVisualDirection,
} from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
export {
  buildMinimalOpenAIRenderPrompt,
  buildOpenAIRenderPromptFromPayload,
  MIRROR_V5_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
export type { MirrorRenderBrief, MirrorLightMode } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
export {
  buildMirrorV5RenderDebugTrace,
  formatMirrorV5RenderDebugTrace,
} from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorV5DebugTrace';
export { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
export { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';

export {
  applyV3PosterBrandOverlayUrl,
  resolveV3SceneDisplayUrl,
  isV3MirrorCard,
} from '@/lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay';
