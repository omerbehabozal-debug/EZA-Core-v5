/**
 * Intent lock — primary intent cannot be overridden by calm tone (Sprint 12B).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import type { ConversationVisualIntentId } from '@/lib/eza/mirror/sceneIntentTypes';
import type { ReflectionSignals, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import {
  buildVehicleHardSceneContractBlock,
  getVehicleContractForbiddenPhrases,
} from '@/lib/eza/mirror/vehicleSceneContract';

export type LockedPrimaryIntentId = ConversationVisualIntentId | null;

export const VEHICLE_LOCK_CUES = [
  'bmw',
  'mercedes',
  'mercedes-benz',
  'audi',
  'araba',
  'araç',
  'otomobil',
  'sedan',
  'suv',
  'car',
  'vehicle',
  'konfor',
  'comfort',
  'uzun yol',
  'long drive',
  'c serisi',
  'c-class',
  'c class',
  '3 serisi',
  '3 series',
  'serie 3',
  'sürüş',
  'driving',
] as const;

export const VEHICLE_COMPARE_CUES = [
  'compare',
  'comparison',
  'versus',
  ' vs ',
  'which',
  'better',
  'between',
  'kıyas',
  'karşılaştır',
  'hangisi',
  'tercih',
  'seçenek',
  'karar',
  'decision',
  'choice',
  'öncelik',
  'priority',
] as const;

export const VEHICLE_LOCK_FORBIDDEN_SCENE = [
  'empty pier',
  'seascape',
  'lonely dock',
  'abstract horizon',
  'generic calm landscape',
  'meditation scenery',
  'ocean pier',
  'wooden pier',
  'coastal dock',
  'travel postcard',
  'contemplation pier',
  'single panda portrait',
  'unrelated travel scene',
  'AI wallpaper',
  'generic seascape',
  'city street',
  'urban avenue',
  'open highway',
  'outdoor road',
  'skyline view',
] as const;

/** Extract safe keyword hints from user message (no full message stored). */
export function extractMirrorCueHintsFromUserText(text: string): string[] {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  const hints: string[] = [];
  for (const c of VEHICLE_LOCK_CUES) {
    if (t.includes(c)) hints.push(c);
  }
  for (const c of VEHICLE_COMPARE_CUES) {
    if (t.includes(c.trim()) || (c.trim() && t.includes(c.trim()))) hints.push(c.trim());
  }
  if (/\bvs\b/.test(t)) hints.push('vs');
  return Array.from(new Set(hints));
}

export function collectIntentCueBlob(entries: SavedBehavioralEntry[]): string {
  const parts: string[] = [];
  const recent = [...entries]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 8);

  for (const e of recent) {
    const intent = (e.vector.intent ?? '').trim().toLowerCase();
    if (intent) parts.push(intent);

    if (e.mirrorCueHints?.length) {
      parts.push(...e.mirrorCueHints.map((h) => String(h).toLowerCase()));
    }

    const obs = parseStandaloneObservation(e.standaloneObservation);
    if (obs?.user_pattern?.category) {
      parts.push(obs.user_pattern.category.toLowerCase());
    }
    if (obs?.ai_behavior?.category) {
      parts.push(obs.ai_behavior.category.toLowerCase());
    }
    if (obs?.relationship_balance?.category) {
      parts.push(obs.relationship_balance.category.toLowerCase());
    }
    if (obs?.user_pattern?.signals?.length) {
      parts.push(...obs.user_pattern.signals.map((s) => String(s).toLowerCase()));
    }
    if (obs?.ai_behavior?.signals?.length) {
      parts.push(...obs.ai_behavior.signals.map((s) => String(s).toLowerCase()));
    }
    if (obs?.relationship_balance?.signals?.length) {
      parts.push(...obs.relationship_balance.signals.map((s) => String(s).toLowerCase()));
    }
    if (obs) {
      try {
        parts.push(JSON.stringify(obs).toLowerCase());
      } catch {
        // ignore
      }
    }
  }

  return parts.join(' ');
}

function cueMatch(blob: string, cues: readonly string[]): boolean {
  return cues.some((c) => blob.includes(c));
}

function countVehicleCues(blob: string): number {
  return VEHICLE_LOCK_CUES.filter((c) => blob.includes(c)).length;
}

export function resolveLockedPrimaryIntent(input: {
  entries: SavedBehavioralEntry[];
  reflectionSignals?: ReflectionSignals;
  storyVariant?: TopicStoryVariantId;
  cueBlob?: string;
}): LockedPrimaryIntentId {
  const blob = input.cueBlob ?? collectIntentCueBlob(input.entries);
  const signals =
    input.reflectionSignals ??
    (input.entries.length ? undefined : undefined);

  const vehicleHits = countVehicleCues(blob);
  const hasCompare =
    cueMatch(blob, VEHICLE_COMPARE_CUES) ||
    input.storyVariant === 'compare' ||
    (signals?.comparisonIntensity ?? 0) >= 0.28;

  const twoBrands =
    (blob.includes('bmw') && blob.includes('mercedes')) ||
    (blob.includes('bmw') && blob.includes('mercedes-benz'));

  if (twoBrands) return 'premium_vehicle_comparison';
  if (vehicleHits >= 2 && hasCompare) return 'premium_vehicle_comparison';
  if (vehicleHits >= 1 && hasCompare && cueMatch(blob, ['konfor', 'comfort', 'uzun yol', 'karar', 'tercih'])) {
    return 'premium_vehicle_comparison';
  }
  if (cueMatch(blob, ['choice_comparison', 'vehicle_comparison', 'car_comparison'])) {
    return 'premium_vehicle_comparison';
  }

  return null;
}

export function isPrimaryIntentLocked(
  intentId: ConversationVisualIntentId,
  locked: LockedPrimaryIntentId
): boolean {
  return locked !== null && locked === intentId;
}

export function buildIntentLockPromptBlock(locked: LockedPrimaryIntentId): string {
  if (locked === 'premium_vehicle_comparison') {
    return buildVehicleHardSceneContractBlock();
  }
  return '';
}

export function getIntentLockForbiddenPhrases(locked: LockedPrimaryIntentId): string[] {
  if (locked === 'premium_vehicle_comparison') {
    return [...VEHICLE_LOCK_FORBIDDEN_SCENE, ...getVehicleContractForbiddenPhrases()];
  }
  return [];
}

export type VehicleHighlightLabels = {
  left: string;
  right: string;
};

export function extractVehicleHighlightLabels(blob: string): VehicleHighlightLabels | null {
  const hasBmw = blob.includes('bmw') || blob.includes('3 serisi') || blob.includes('3 series');
  const hasMercedes =
    blob.includes('mercedes') || blob.includes('c serisi') || blob.includes('c-class') || blob.includes('c class');

  if (hasBmw && hasMercedes) {
    return {
      left: 'BMW 3 Serisi',
      right: 'Mercedes C Serisi',
    };
  }
  if (hasBmw) {
    return { left: 'BMW 3 Serisi', right: 'Alternatif sedan' };
  }
  if (hasMercedes) {
    return { left: 'Seçenek A', right: 'Mercedes C Serisi' };
  }
  return null;
}

/** VS band copy for premium vehicle comparison (Sprint 12C). */
export function buildVehicleComparisonHighlightSides(
  labels: VehicleHighlightLabels,
  comfortPriority: boolean
): { left: { label: string; hint: string }; right: { label: string; hint: string } } {
  const mercedesRight = labels.right.toLowerCase().includes('mercedes');
  return {
    left: {
      label: labels.left,
      hint: 'Sürüş hissi / dinamik karakter',
    },
    right: {
      label: labels.right,
      hint: mercedesRight && comfortPriority
        ? 'Konfor / dengeli deneyim · öncelik'
        : 'Konfor / dengeli deneyim',
    },
  };
}

/** Tone may adjust light/color only — never swap locked intent. */
export function applyEmotionalToneLimiter(
  locked: LockedPrimaryIntentId,
  atmospherePhrase: string
): string {
  if (!locked) return atmospherePhrase;
  return `${atmospherePhrase}, warm soft editorial light without changing subject matter`;
}
