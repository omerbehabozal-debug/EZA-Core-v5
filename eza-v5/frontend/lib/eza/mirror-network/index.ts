export {
  CURIOSITY_SEED_INTELLIGENCE_LABEL,
  MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT,
  evaluateMirrorPhilosophyCheck,
  formatMirrorPhilosophyCheck,
  SAINA_MIRROR_PHILOSOPHY_MANIFESTO,
} from '@/lib/eza/mirror-network/philosophy';

export type { MirrorPhilosophyCheck } from '@/lib/eza/mirror-network/philosophy';

export type {
  MirrorLandingSurface,
  MirrorNetworkPublicApiResponse,
} from '@/lib/eza/mirror-network/publicTypes';

export {
  assertMirrorLandingSurfaceClean,
  formatMirrorLandingDate,
  pickMirrorLandingSurface,
} from '@/lib/eza/mirror-network/landingSurface';

export { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';

export type {
  MirrorCuriosityBundle,
  MirrorCuriosityContext,
  MirrorCuriosityPipeline,
  MirrorImagePromptLeakageAudit,
  MirrorSeed,
  MirrorTopicDNA,
  MirrorTopicMood,
} from '@/lib/eza/mirror-network/types';

export {
  buildMirrorCardTitle,
  buildMirrorCoreCuriosity,
  buildMirrorCuriosityBundle,
  buildMirrorCuriosityContext,
  buildMirrorCuriosityPipeline,
  buildMirrorSeed,
  buildMirrorTopicDNA,
} from '@/lib/eza/mirror-network/buildMirrorCuriosity';

export {
  auditMirrorImagePromptLeakage,
  type MirrorLeakageAuditOptions,
} from '@/lib/eza/mirror-network/auditImagePrompt';
