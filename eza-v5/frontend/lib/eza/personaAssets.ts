/**
 * Persona visual asset slots — future-ready illustration keys per family.
 */

import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';

export type PersonaVisualTone =
  | 'soft_animal'
  | 'symbolic_object'
  | 'abstract_shape'
  | 'human_minimal';

export interface PersonaAssetSlot {
  illustrationKey?: string;
  iconFallback: string;
  visualTone: PersonaVisualTone;
  colorToken: string;
}

/** Public path: /personas/{illustrationKey}.webp (optional; fallback if missing) */
export const PERSONA_ILLUSTRATION_BASE = '/personas';

export const FAMILY_ASSET_SLOTS: Record<PersonaFamilyId, PersonaAssetSlot> = {
  curiosity_exploration: {
    illustrationKey: 'curiosity-exploration',
    iconFallback: '🔍',
    visualTone: 'soft_animal',
    colorToken: 'violet',
  },
  decision_direction: {
    illustrationKey: 'decision-direction',
    iconFallback: '🐧',
    visualTone: 'soft_animal',
    colorToken: 'sky',
  },
  clarity_simplification: {
    illustrationKey: 'clarity-simplification',
    iconFallback: '💎',
    visualTone: 'symbolic_object',
    colorToken: 'teal',
  },
  ideation_creation: {
    illustrationKey: 'ideation-creation',
    iconFallback: '💡',
    visualTone: 'abstract_shape',
    colorToken: 'amber',
  },
  deep_thinking: {
    illustrationKey: 'deep-thinking',
    iconFallback: '🦔',
    visualTone: 'soft_animal',
    colorToken: 'indigo',
  },
  sensitive_careful: {
    illustrationKey: 'sensitive-careful',
    iconFallback: '🌿',
    visualTone: 'human_minimal',
    colorToken: 'rose',
  },
  fast_practical: {
    illustrationKey: 'fast-practical',
    iconFallback: '⚡',
    visualTone: 'symbolic_object',
    colorToken: 'orange',
  },
  planning_structure: {
    illustrationKey: 'planning-structure',
    iconFallback: '📅',
    visualTone: 'symbolic_object',
    colorToken: 'slate',
  },
  trust_verification: {
    illustrationKey: 'trust-verification',
    iconFallback: '🔎',
    visualTone: 'human_minimal',
    colorToken: 'blue',
  },
  balanced_calm: {
    illustrationKey: 'balanced-calm',
    iconFallback: '🌿',
    visualTone: 'soft_animal',
    colorToken: 'stone',
  },
};

export const PERSONA_COLOR_GRADIENT: Record<string, string> = {
  violet: 'from-violet-50/95 via-white/80 to-sky-50/90',
  sky: 'from-sky-50/95 via-white/80 to-indigo-50/85',
  teal: 'from-teal-50/95 via-white/80 to-emerald-50/85',
  amber: 'from-amber-50/95 via-white/80 to-orange-50/80',
  indigo: 'from-indigo-50/95 via-white/80 to-violet-50/85',
  rose: 'from-rose-50/95 via-white/80 to-amber-50/75',
  orange: 'from-orange-50/95 via-white/80 to-amber-50/80',
  slate: 'from-slate-50/95 via-white/80 to-stone-50/90',
  blue: 'from-blue-50/95 via-white/80 to-sky-50/90',
  stone: 'from-stone-50/95 via-white/80 to-teal-50/80',
};

export function personaIllustrationSrc(illustrationKey?: string): string | null {
  if (!illustrationKey) return null;
  return `${PERSONA_ILLUSTRATION_BASE}/${illustrationKey}.webp`;
}

export function assetSlotForFamily(familyId: PersonaFamilyId): PersonaAssetSlot {
  return FAMILY_ASSET_SLOTS[familyId];
}
