/**
 * Visual conflict — dual composition for compare/decision (Sprint 11O).
 */

import type { ConversationVisualIntentId } from '@/lib/eza/mirror/sceneIntentTypes';
import type { SceneCompositionTemplateId } from '@/lib/eza/mirror/sceneIntentTypes';
import type { EmotionalPacingId } from '@/lib/eza/mirror/emotionalPacingEngine';

export type VisualConflictLevel = 'none' | 'subtle' | 'dual';

const CONFLICT_INTENTS = new Set<ConversationVisualIntentId>([
  'premium_vehicle_comparison',
  'product_comparison',
  'financial_decision',
]);

const CONFLICT_COMPOSITIONS = new Set<SceneCompositionTemplateId>([
  'comparison_scene',
  'research_scene',
]);

export function resolveVisualConflictLevel(
  intentId: ConversationVisualIntentId,
  composition: SceneCompositionTemplateId,
  pacing: EmotionalPacingId
): VisualConflictLevel {
  if (pacing === 'cinematic_tension' || pacing === 'active') {
    if (CONFLICT_INTENTS.has(intentId) || composition === 'comparison_scene') {
      return 'dual';
    }
    if (composition === 'research_scene' && intentId === 'financial_decision') {
      return 'subtle';
    }
  }
  if (CONFLICT_INTENTS.has(intentId)) return 'subtle';
  return 'none';
}

export function buildVisualConflictPhrases(level: VisualConflictLevel): string[] {
  if (level === 'none') return [];
  if (level === 'subtle') {
    return [
      'subtle visual tension between two choices warm versus cool accent on each option',
      'soft duality in light not aggressive advertising split',
    ];
  }
  return [
    'dual composition visual conflict two options two light temperatures two directional vectors',
    'foreground option warm rim background option cool fill decision tension editorial not poster ad',
    'asymmetric balance between paths eye travels between objects',
  ];
}
