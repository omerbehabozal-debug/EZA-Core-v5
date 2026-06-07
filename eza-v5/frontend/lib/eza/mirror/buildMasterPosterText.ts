/**
 * Master poster text — delegates to narrative alignment engine.
 */

import type { StoryTopicResolution } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { MasterPosterText } from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  alignMasterPosterText,
  type AlignMasterPosterTextInput,
} from '@/lib/eza/mirror/narrativeAlignmentEngine';

export type BuildMasterPosterTextInput = AlignMasterPosterTextInput;

export function buildMasterPosterText(input: BuildMasterPosterTextInput): MasterPosterText {
  return alignMasterPosterText(input);
}

/** Convenience wrapper for mirror state pipeline. */
export function buildMasterPosterTextFromCardFields(input: {
  dailyJourney?: string;
  headline?: string;
  quote?: string;
  mirrorMoment?: string;
  dailyThemeTitle?: string;
  tomorrowHint?: string;
  themeDescription?: string;
  storyTopicResolution: StoryTopicResolution;
  sceneSubtopicResolution: SceneSubtopicResolution;
}): MasterPosterText {
  return alignMasterPosterText(input);
}
