/**
 * Story topic model — privacy-safe day themes (no raw chat).
 */

export type StoryTopicId =
  | 'vehicle'
  | 'travel'
  | 'architecture'
  | 'technology_ai'
  | 'finance'
  | 'health'
  | 'food_culture'
  | 'family'
  | 'education'
  | 'spiritual_reflection'
  | 'general_curiosity';

export type StoryTopicSource = 'cues' | 'observation' | 'mixed' | 'fallback';

export interface StoryTopicResolution {
  primaryTopic: StoryTopicId;
  secondaryTopic?: StoryTopicId;
  confidence: number;
  cueTokens: string[];
  source: StoryTopicSource;
}
