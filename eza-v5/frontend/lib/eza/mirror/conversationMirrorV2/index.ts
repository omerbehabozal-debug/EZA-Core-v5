export type {
  SainaMirrorSeason,
  SainaMirrorPayload,
  SainaMirrorEmotionalTone,
  SainaMirrorSafetyLevel,
} from '@/lib/eza/mirror/conversationMirrorV2/types';
export { MIRROR_V2_ASPECT, MIRROR_PIPELINE_VERSION } from '@/lib/eza/mirror/conversationMirrorV2/types';

export { MIRROR_SEASON_REGISTRY, resolveActiveSeason, getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';

export { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
export { buildMirrorV2ImagePrompt, MIRROR_V2_NEGATIVE_PROMPT } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
export { buildVisualPayloadFromMirrorV2 } from '@/lib/eza/mirror/conversationMirrorV2/visualPayloadAdapter';
export { buildMirrorStateV2 } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorStateV2';

export {
  assessMirrorSafetyLevel,
  applySafetyToScene,
  SAFE_METAPHOR_SCENE,
} from '@/lib/eza/mirror/conversationMirrorV2/safetyFilter';

export {
  applyV2PosterBrandOverlayUrl,
  resolveV2SceneDisplayUrl,
  isV2MirrorCard,
  loadSainaLogoImage,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/applyV2SceneOverlay';

export {
  applyPosterBrandOverlay,
  buildPosterOverlaySpec,
  revokePosterObjectUrl as revokePosterBlobUrl,
  MIRROR_V2_CARD_WIDTH,
  MIRROR_V2_CARD_HEIGHT,
} from '@/lib/eza/mirror/conversationMirrorV2/posterOverlay';

export {
  isMirrorPipelineV2,
  resolveMirrorPipelineVersion,
  setDevMirrorPipeline,
  clearDevMirrorPipeline,
} from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';

export { TOPIC_MIRROR_TEMPLATES, composeTopicMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalog';

export {
  MIRROR_V2_QA_SCENARIOS,
  MIRROR_V2_QA_SCORE_LABELS,
  readMirrorV2QaScores,
  saveMirrorV2QaScore,
  type MirrorV2QaScore,
} from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';
