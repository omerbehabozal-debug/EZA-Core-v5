/**
 * Standalone observation — parse backend payload, map categories, source priority.
 */

import type { StandaloneObservation } from '@/lib/types';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type {
  AiBehaviorCategoryId,
  UserObservationCategoryId,
} from '@/lib/eza/dailyObservation';
import {
  aiLineForBackendCategory,
  balanceLineForBackendCategory,
} from '@/lib/eza/presentationTone';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { personaFamilyForCategory } from '@/lib/eza/standalonePersonas';

export type BackendUserCategory =
  | 'curiosity_exploration'
  | 'decision_direction'
  | 'clarity_simplification'
  | 'ideation_creation'
  | 'deep_thinking'
  | 'sensitive_careful'
  | 'fast_practical'
  | 'planning_structure'
  | 'trust_verification'
  | 'balanced_calm';

export type BackendAiCategory =
  | 'explanatory'
  | 'guiding'
  | 'careful'
  | 'creative'
  | 'calm'
  | 'clear'
  | 'structured'
  | 'protective'
  | 'aligned'
  | 'reflective';

export type BackendBalanceCategory =
  | 'harmonious_flow'
  | 'safe_balance'
  | 'exploration_balance'
  | 'decision_balance'
  | 'clarity_balance'
  | 'creative_balance'
  | 'careful_balance'
  | 'calm_rhythm'
  | 'explanation_balance'
  | 'boundary_balance';

export type ObservationSource = 'backend' | 'fallback' | 'empty';

const BACKEND_USER_CATEGORIES = new Set<string>([
  'curiosity_exploration',
  'decision_direction',
  'clarity_simplification',
  'ideation_creation',
  'deep_thinking',
  'sensitive_careful',
  'fast_practical',
  'planning_structure',
  'trust_verification',
  'balanced_calm',
]);

const BACKEND_AI_CATEGORIES = new Set<string>([
  'explanatory',
  'guiding',
  'careful',
  'creative',
  'calm',
  'clear',
  'structured',
  'protective',
  'aligned',
  'reflective',
]);

const BACKEND_BALANCE_CATEGORIES = new Set<string>([
  'harmonious_flow',
  'safe_balance',
  'exploration_balance',
  'decision_balance',
  'clarity_balance',
  'creative_balance',
  'careful_balance',
  'calm_rhythm',
  'explanation_balance',
  'boundary_balance',
]);

const USER_MAP: Record<BackendUserCategory, UserObservationCategoryId> = {
  curiosity_exploration: 'exploration',
  decision_direction: 'decision_support',
  clarity_simplification: 'clarity_seek',
  ideation_creation: 'creative_ideas',
  deep_thinking: 'intellectual_depth',
  sensitive_careful: 'sensitive_signals',
  fast_practical: 'question_clarity',
  planning_structure: 'clarity_seek',
  trust_verification: 'explanation_seek',
  balanced_calm: 'balanced',
};

const AI_MAP: Record<BackendAiCategory, AiBehaviorCategoryId> = {
  explanatory: 'explanatory',
  guiding: 'suggestion_density',
  careful: 'balanced_refusal',
  creative: 'suggestion_density',
  calm: 'neutral_tone',
  clear: 'low_redirect',
  structured: 'explanatory',
  protective: 'sensitive_balance',
  aligned: 'high_alignment',
  reflective: 'neutral_tone',
};

const BACKEND_USER_TO_PERSONA: Record<BackendUserCategory, PersonaFamilyId> = {
  curiosity_exploration: 'curiosity_exploration',
  decision_direction: 'decision_direction',
  clarity_simplification: 'clarity_simplification',
  ideation_creation: 'ideation_creation',
  deep_thinking: 'deep_thinking',
  sensitive_careful: 'sensitive_careful',
  fast_practical: 'fast_practical',
  planning_structure: 'planning_structure',
  trust_verification: 'trust_verification',
  balanced_calm: 'balanced_calm',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePattern(raw: unknown): StandaloneObservation['user_pattern'] | null {
  if (!isRecord(raw)) return null;
  const category = typeof raw.category === 'string' ? raw.category : '';
  const confidence =
    typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5;
  const signals = Array.isArray(raw.signals)
    ? raw.signals.filter((s): s is string => typeof s === 'string').slice(0, 12)
    : [];
  if (!category) return null;
  return { category, confidence, signals };
}

export function parseStandaloneObservation(raw: unknown): StandaloneObservation | null {
  if (!isRecord(raw)) return null;
  const user = parsePattern(raw.user_pattern);
  const ai = parsePattern(raw.ai_behavior);
  const balance = parsePattern(raw.relationship_balance);
  if (!user || !ai || !balance) return null;

  const quality = raw.observation_quality;
  const observation_quality =
    quality === 'low' || quality === 'medium' || quality === 'high' ? quality : undefined;

  return {
    user_pattern: user,
    ai_behavior: ai,
    relationship_balance: balance,
    observation_quality,
    can_interpret: typeof raw.can_interpret === 'boolean' ? raw.can_interpret : undefined,
    disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : undefined,
  };
}

export function mapBackendUserCategory(
  raw: string | undefined | null
): UserObservationCategoryId {
  if (raw && BACKEND_USER_CATEGORIES.has(raw)) {
    return USER_MAP[raw as BackendUserCategory];
  }
  return 'balanced';
}

export function mapBackendAiCategory(raw: string | undefined | null): AiBehaviorCategoryId {
  if (raw && BACKEND_AI_CATEGORIES.has(raw)) {
    return AI_MAP[raw as BackendAiCategory];
  }
  return 'neutral_tone';
}

export function mapBackendUserToPersonaFamily(raw: string | undefined | null): PersonaFamilyId {
  if (raw && BACKEND_USER_CATEGORIES.has(raw)) {
    return BACKEND_USER_TO_PERSONA[raw as BackendUserCategory];
  }
  return 'balanced_calm';
}

export function isBackendUserCategory(raw: string): raw is BackendUserCategory {
  return BACKEND_USER_CATEGORIES.has(raw);
}

export function isBackendAiCategory(raw: string): raw is BackendAiCategory {
  return BACKEND_AI_CATEGORIES.has(raw);
}

export function isBackendBalanceCategory(raw: string): raw is BackendBalanceCategory {
  return BACKEND_BALANCE_CATEGORIES.has(raw);
}

export interface MappedBackendObservation {
  source: 'backend';
  raw: StandaloneObservation;
  userCategory: UserObservationCategoryId;
  aiCategory: AiBehaviorCategoryId;
  personaFamily: PersonaFamilyId;
  backendUserCategory: string;
  backendAiCategory: string;
  backendBalanceCategory: string;
  userConfidence: number;
  aiConfidence: number;
  balanceConfidence: number;
}

export function mapBackendObservation(
  obs: StandaloneObservation
): MappedBackendObservation {
  const backendUser = obs.user_pattern.category;
  const backendAi = obs.ai_behavior.category;
  const backendBalance = obs.relationship_balance.category;

  return {
    source: 'backend',
    raw: obs,
    userCategory: mapBackendUserCategory(backendUser),
    aiCategory: mapBackendAiCategory(backendAi),
    personaFamily: mapBackendUserToPersonaFamily(backendUser),
    backendUserCategory: backendUser,
    backendAiCategory: backendAi,
    backendBalanceCategory: backendBalance,
    userConfidence: obs.user_pattern.confidence,
    aiConfidence: obs.ai_behavior.confidence,
    balanceConfidence: obs.relationship_balance.confidence,
  };
}

export function findLatestStandaloneObservation(
  entries: SavedBehavioralEntry[]
): StandaloneObservation | null {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  for (const entry of sorted) {
    const parsed = parseStandaloneObservation(entry.standaloneObservation);
    if (parsed) return parsed;
  }
  return null;
}

export function resolveObservationSource(entries: SavedBehavioralEntry[]): ObservationSource {
  if (!entries.length) return 'empty';
  const hasBackend = entries.some(
    (e) => parseStandaloneObservation(e.standaloneObservation) !== null
  );
  return hasBackend ? 'backend' : 'fallback';
}

export function logObservationSourceDev(
  source: ObservationSource,
  detail?: string
): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.debug('[eza-observation]', `observation source: ${source}`, detail ?? '');
}

export function buildPersonaSeed(
  entries: SavedBehavioralEntry[],
  personaFamily: PersonaFamilyId
): string {
  const latest = [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  )[0];
  const dateBucket = latest?.savedAt
    ? new Date(latest.savedAt).toISOString().slice(0, 10)
    : 'no-date';
  const sessionId = latest?.interaction_id ?? 'session';
  return `${sessionId}-${dateBucket}-${entries.length}-${personaFamily}`;
}

export function backendAiLine(
  backendAiCategory: string,
  seed: string,
  tone: 'standalone' | 'governance' = 'standalone'
): string {
  if (isBackendAiCategory(backendAiCategory)) {
    return aiLineForBackendCategory(backendAiCategory, tone, seed);
  }
  return aiLineForBackendCategory('calm', tone, seed);
}

export function backendBalanceLine(
  backendBalanceCategory: string,
  seed: string,
  tone: 'standalone' | 'governance' = 'standalone'
): string {
  if (isBackendBalanceCategory(backendBalanceCategory)) {
    return balanceLineForBackendCategory(backendBalanceCategory, tone, seed);
  }
  return balanceLineForBackendCategory('calm_rhythm', tone, seed);
}

export function confidenceLabelFromBackend(
  sampleCount: number,
  mapped: MappedBackendObservation
): string {
  const avg =
    (mapped.userConfidence + mapped.aiConfidence + mapped.balanceConfidence) / 3;
  if (mapped.raw.observation_quality === 'high' || avg >= 0.74) return 'Güven: Orta';
  if (mapped.raw.observation_quality === 'medium' || avg >= 0.62) return 'Güven: Orta';
  if (sampleCount >= 3) return 'Güven: Ön gözlem';
  return 'Güven: Ön gözlem';
}

/** Dominant backend user category from history (weighted by confidence). */
export function dominantBackendUserCategory(
  entries: SavedBehavioralEntry[]
): BackendUserCategory | null {
  const weights = new Map<string, number>();
  for (const entry of entries) {
    const obs = parseStandaloneObservation(entry.standaloneObservation);
    if (!obs || !isBackendUserCategory(obs.user_pattern.category)) continue;
    const w = obs.user_pattern.confidence || 0.5;
    weights.set(
      obs.user_pattern.category,
      (weights.get(obs.user_pattern.category) ?? 0) + w
    );
  }
  if (!weights.size) return null;
  let best: string | null = null;
  let bestW = -1;
  for (const [cat, w] of Array.from(weights.entries())) {
    if (w > bestW) {
      bestW = w;
      best = cat;
    }
  }
  return best && isBackendUserCategory(best) ? best : null;
}

export function personaFamilyFromEntries(
  entries: SavedBehavioralEntry[],
  fallbackUserCategory?: UserObservationCategoryId
): PersonaFamilyId {
  const dom = dominantBackendUserCategory(entries);
  if (dom) return mapBackendUserToPersonaFamily(dom);
  return personaFamilyForCategory(fallbackUserCategory);
}
