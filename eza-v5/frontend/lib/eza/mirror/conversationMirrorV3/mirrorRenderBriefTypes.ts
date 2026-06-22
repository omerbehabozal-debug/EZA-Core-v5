/**
 * V5 — Mirror Intelligence → OpenAI Render Layer brief.
 * Raw conversation, evidence lists, and debug traces never enter image prompts.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type MirrorLightMode =
  | 'premium_editorial_daylight'
  | 'golden_hour_travel'
  | 'soft_architectural_daylight'
  | 'clean_health_daylight'
  | 'modern_technology_light'
  | 'golden_hour_road'
  | 'contemplative_morning'
  | 'quiet_luxury_evening';

export type MirrorSafetyMode = 'normal' | 'abstract_safe';

export type MirrorRenderBrief = {
  title: string;
  topicCategory: StoryTopicId;
  mood?: string;
  publicTopicHint: string;
  visualDirection: string;
  lightMode: MirrorLightMode;
  locale: 'tr' | 'en';
  safetyMode: MirrorSafetyMode;
  /** V5 default — body copy stays on landing, not in OpenAI image prompt. */
  showSubtitleOnPoster: boolean;
};

export const MIRROR_V5_MAX_RENDER_PROMPT_CHARS = 1400;
export const MIRROR_V5_SHOW_SUBTITLE_ON_POSTER = false;

export const MIRROR_V5_DEFAULT_LIGHT_MODE: MirrorLightMode = 'premium_editorial_daylight';

export const MIRROR_V5_PROMPT_CONTRACT = 'saina_mirror_v5_minimal' as const;
export const MIRROR_V5_RENDER_CONTRACT_MARKER = 'SAINA_RENDER_CONTRACT: V5_MINIMAL' as const;
