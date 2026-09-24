export type {
  CuriosityBuilderLocale,
  CuriosityBuilderOutput,
} from '@/lib/eza/mirror/curiosityBuilder/types';
export { MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION } from '@/lib/eza/mirror/curiosityBuilder/types';
export {
  buildCuriosityCard,
  curiosityCardFingerprint,
  composeCompleteTitle,
  clampAtWordBoundary,
  endsIncompletely,
  isCriteriaOnlyTitle,
  type BuildCuriosityCardInput,
  type TitleAuthorities,
} from '@/lib/eza/mirror/curiosityBuilder/buildCuriosityCard';
export {
  runCuriosityClickTest,
  clickTestAccepted,
} from '@/lib/eza/mirror/curiosityBuilder/clickTest';
