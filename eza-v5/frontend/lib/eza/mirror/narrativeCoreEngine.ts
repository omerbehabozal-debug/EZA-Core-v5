/**
 * P4-A — Narrative Core: day's primary story motor from entries + intent.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { collectIntentCueBlob } from '@/lib/eza/mirror/intentLockSystem';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import type { ReflectionSignals, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';

export type ComposeNarrativeCoreInput = {
  entries: SavedBehavioralEntry[];
  lockedIntent: LockedPrimaryIntentId;
  storyTopicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  reflectionSignals: ReflectionSignals;
  cueBlob?: string;
};

function cue(blob: string, patterns: string[]): boolean {
  return patterns.some((p) => blob.includes(p));
}

export function composeNarrativeCore(input: ComposeNarrativeCoreInput): NarrativeCoreId {
  const blob = (input.cueBlob ?? collectIntentCueBlob(input.entries)).toLowerCase();
  const { lockedIntent, storyTopicKey, storyVariant, reflectionSignals: s } = input;

  if (lockedIntent === 'premium_vehicle_comparison') return 'comparison';

  if (
    storyVariant === 'compare' ||
    s.comparisonIntensity >= 0.45 ||
    cue(blob, ['bmw', 'mercedes', 'versus', ' vs ', 'kıyas', 'compare', 'hangisi', 'better'])
  ) {
    return 'comparison';
  }

  if (
    cue(blob, ['semerkant', 'samarkand', 'registan', 'buhara', 'hive', 'seyahat', 'travel', 'keşif', 'explore']) ||
    (storyTopicKey === 'travel' && s.explorationMode >= 0.35)
  ) {
    return 'exploration';
  }

  if (
    storyTopicKey === 'architecture' ||
    cue(blob, ['mimari', 'architecture', 'villa', 'restorasyon', 'cephe', 'malzeme', 'facade', 'material'])
  ) {
    return 'creation';
  }

  if (
    storyTopicKey === 'creativity' ||
    cue(blob, ['yaratı', 'creative', 'tasarım', 'design', 'ilham', 'ürün', 'product', 'roadmap'])
  ) {
    return 'creation';
  }

  if (
    storyTopicKey === 'health' ||
    cue(blob, ['sağlık', 'health', 'wellness', 'beslenme', 'uyku', 'egzersiz', 'fitness', 'iyi oluş'])
  ) {
    return 'care';
  }

  if (
    storyTopicKey === 'finance' ||
    cue(blob, ['finans', 'finance', 'yatırım', 'invest', 'risk', 'bütçe', 'budget', 'gelecek'])
  ) {
    return 'uncertainty';
  }

  if (storyVariant === 'planning' || s.decisiveness >= 0.5) return 'planning';

  if (storyVariant === 'clarify' || s.detailFocus >= 0.52) return 'clarity';

  if (storyTopicKey === 'friendship' || s.emotionalOpenness >= 0.42) return 'trust';

  if (s.calmnessLevel >= 0.58 && s.comparisonIntensity < 0.3) return 'balance';

  if (storyTopicKey === 'general') return 'general_reflection';

  return 'general_reflection';
}
