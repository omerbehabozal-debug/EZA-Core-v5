/**
 * Sprint 12C — Hard visual contract for premium_vehicle_comparison.
 * Prompt must pass validation before scene generation.
 */

import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

export const VEHICLE_SCENE_CONTRACT_ID = 'vehicle_comparison_showroom' as const;

/** Required substrings (prompt, lowercase). */
export const VEHICLE_SCENE_REQUIRED = [
  'two premium executive sedans',
  'showroom',
  'standing between',
  'comparison',
  'comfort',
  'decision',
] as const;

/** Forbidden outdoor/urban tokens — presence fails contract. */
export const VEHICLE_SCENE_FORBIDDEN = [
  'city street',
  'city',
  'street',
  'road',
  'highway',
  'skyline',
  'pier',
  'dock',
  'seascape',
  'empty street',
  'urban avenue',
  'landscape',
  'generic city',
  'outdoor avenue',
  'urban traffic',
  'traffic',
  'downtown',
  'avenue',
] as const;

export const VEHICLE_OUTDOOR_REJECTION =
  'Never depict outdoor motoring environments or open-air avenues. Indoor premium showroom mandatory with two sedans clearly visible.';

export const VEHICLE_HARD_SCENE_CORE = [
  'SCENE CONTRACT vehicle_comparison_showroom',
  'indoor premium car showroom or garage studio only',
  'two premium executive sedans visible in foreground and midground',
  'thoughtful person standing between the two cars',
  'visual comparison decision board in background without readable text',
  'comfort and long-distance driving priority mood',
  'warm cinematic showroom lighting beige sand and soft violet editorial accents',
  'editorial luxury automotive comparison scene indoor only no outdoor environment',
  VEHICLE_OUTDOOR_REJECTION,
].join(', ');

function containsForbiddenToken(lower: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  if (!re.test(lower)) return false;
  if (new RegExp(`not\\s+${escaped}`, 'i').test(lower)) return false;
  if (new RegExp(`no\\s+${escaped}`, 'i').test(lower)) return false;
  return true;
}

export type VehiclePromptValidation = {
  ok: boolean;
  missing: string[];
  forbidden: string[];
};

export function validateVehicleComparisonPrompt(prompt: string): VehiclePromptValidation {
  const lower = prompt.toLowerCase();
  const missing = VEHICLE_SCENE_REQUIRED.filter((token) => !lower.includes(token));
  const forbidden = VEHICLE_SCENE_FORBIDDEN.filter((token) => containsForbiddenToken(lower, token));
  return {
    ok: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
  };
}

/** Throws when contract violated — used in tests and dev prompt assembly. */
export function assertVehicleComparisonPrompt(prompt: string): void {
  const result = validateVehicleComparisonPrompt(prompt);
  if (result.ok) return;
  const parts: string[] = [];
  if (result.missing.length) {
    parts.push(`missing required: ${result.missing.join(', ')}`);
  }
  if (result.forbidden.length) {
    parts.push(`forbidden outdoor tokens: ${result.forbidden.join(', ')}`);
  }
  throw new Error(`Vehicle scene contract failed: ${parts.join('; ')}`);
}

export function isVehicleSceneContractActive(locked: LockedPrimaryIntentId): boolean {
  return locked === 'premium_vehicle_comparison';
}

export function buildVehicleHardSceneContractBlock(): string {
  return VEHICLE_HARD_SCENE_CORE;
}

export function getVehicleContractForbiddenPhrases(): string[] {
  return [
    ...VEHICLE_SCENE_FORBIDDEN,
    'city street',
    'outdoor road',
    'urban skyline',
    'open road',
    'country road',
    'coastal road',
    'night city',
    'street view',
    'traffic scene',
  ];
}

/**
 * Ensures assembled prompt satisfies hard contract; appends core if needed then asserts.
 */
export function enforceVehicleComparisonPrompt(
  prompt: string,
  locked: LockedPrimaryIntentId
): string {
  if (!isVehicleSceneContractActive(locked)) return prompt;

  let merged = prompt;
  const first = validateVehicleComparisonPrompt(merged);
  if (!first.ok) {
    merged = `${VEHICLE_HARD_SCENE_CORE}, ${merged}`;
  }
  assertVehicleComparisonPrompt(merged);
  return merged;
}
