/**
 * Dev-only fixtures for /dev/mirror-poster (travel / Italy narrative).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';

function devEntry(
  intent: string,
  userCategory: string,
  balanceCategory: string,
  idx: number
): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `dev-poster-${idx}`,
    mode: 'standalone',
    savedAt: new Date(Date.now() - idx * 60_000).toISOString(),
    vector: {
      input_risk: 0.12,
      output_risk: 0.1,
      input_health: 0.88,
      output_health: 0.9,
      alignment_score: 84,
      eza_final: 78,
      intent,
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.02, index: 0.08 },
    standaloneObservation: {
      user_pattern: { category: userCategory, confidence: 0.85, signals: ['dev'] },
      ai_behavior: { category: 'explanatory', confidence: 0.82, signals: ['travel'] },
      relationship_balance: {
        category: balanceCategory,
        confidence: 0.8,
        signals: ['dev'],
      },
    },
  };
}

/**
 * Warm Italy / Florence demo scene for localhost poster QA (no API).
 * Same-origin not required; Unsplash allows hotlink for dev preview.
 */
/** Same-origin cinematic plate (Florence-style warm travel demo). */
export const DEV_ITALY_DEMO_SCENE_URL = '/mirror/dev-italy-scene.jpg';

/** Seyahat / keşif — Florence–Italy cinematic scene intent. */
export function buildDevItalyTravelEntries(): SavedBehavioralEntry[] {
  const intent =
    'travel italy florence explore trip conversation café ponte vecchio sunset connection';
  return [0, 1, 2, 3].map((i) =>
    devEntry(intent, 'curiosity_exploration', 'exploration_balance', i)
  );
}

export function buildDevItalyPosterCard(): {
  card: DailyMirrorCardModel;
  meta: MirrorStateMeta;
} {
  const state = buildMirrorState(buildDevItalyTravelEntries(), {
    seed: 'dev-italy-travel-poster',
  });
  const card: DailyMirrorCardModel = {
    ...state.dailyMirrorCard,
    dayLabel: '15 Haziran 2025',
    dailyAvatarName: 'İtalyan Sohbeti',
    mirrorMoment: 'Paylaştıkça yol açılır.',
    storyTensionTitle: 'İki yol, tek karar.',
    dailyThemeTitle: 'Keşif',
    dailyThemeSubtitle: 'Seyahat ve bağlantı',
    tomorrowHint: 'Yarın için küçük bir adım at.',
    energyScore: 81,
    visual: state.dailyMirrorCard.visual
      ? {
          ...state.dailyMirrorCard.visual,
          sceneImageUrl: DEV_ITALY_DEMO_SCENE_URL,
          sceneImageStatus: 'ready',
        }
      : undefined,
  };
  return { card, meta: state.meta };
}
