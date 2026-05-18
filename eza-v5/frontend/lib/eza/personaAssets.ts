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
    illustrationKey: 'curiosity_exploration',
    iconFallback: '🦊',
    visualTone: 'soft_animal',
    colorToken: 'violet',
  },
  decision_direction: {
    illustrationKey: 'decision_direction',
    iconFallback: '🐧',
    visualTone: 'soft_animal',
    colorToken: 'sky',
  },
  clarity_simplification: {
    illustrationKey: 'clarity_simplification',
    iconFallback: '🦉',
    visualTone: 'soft_animal',
    colorToken: 'teal',
  },
  ideation_creation: {
    illustrationKey: 'ideation_creation',
    iconFallback: '🦎',
    visualTone: 'soft_animal',
    colorToken: 'amber',
  },
  deep_thinking: {
    illustrationKey: 'deep_thinking',
    iconFallback: '🐋',
    visualTone: 'soft_animal',
    colorToken: 'indigo',
  },
  sensitive_careful: {
    illustrationKey: 'sensitive_careful',
    iconFallback: '🦌',
    visualTone: 'soft_animal',
    colorToken: 'rose',
  },
  fast_practical: {
    illustrationKey: 'fast_practical',
    iconFallback: '🐿️',
    visualTone: 'soft_animal',
    colorToken: 'orange',
  },
  planning_structure: {
    illustrationKey: 'planning_structure',
    iconFallback: '🦫',
    visualTone: 'soft_animal',
    colorToken: 'slate',
  },
  trust_verification: {
    illustrationKey: 'trust_verification',
    iconFallback: '🐦‍⬛',
    visualTone: 'soft_animal',
    colorToken: 'blue',
  },
  balanced_calm: {
    illustrationKey: 'balanced_calm',
    iconFallback: '🐼',
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
