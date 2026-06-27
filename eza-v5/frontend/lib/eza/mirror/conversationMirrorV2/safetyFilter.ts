/**
 * Mirror V2 — prompt safety gate before image generation.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { SainaMirrorSafetyLevel } from '@/lib/eza/mirror/conversationMirrorV2/types';

const RESTRICTED_CUES = [
  'intihar',
  'kendine zarar',
  'self harm',
  'suicide',
  'şiddet',
  'violence',
  'nefret',
  'hate',
  'taciz',
  'harass',
  'çocuk',
  'child abuse',
  'cp',
];

const SENSITIVE_CUES = [
  'cinsel',
  'sexual',
  'mahrem',
  'intimate',
  'politik',
  'political',
  'din',
  'religion',
  'sağlık',
  'health',
  'hastalık',
  'depresyon',
  'korku',
  'travma',
];

function collectCueText(entries: SavedBehavioralEntry[]): string {
  const tokens = entries.flatMap((e) => e.mirrorCueHints ?? []);
  return tokens.join(' ').toLowerCase();
}

function cueMatches(haystack: string, cue: string): boolean {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (cue.length <= 4) {
    return new RegExp(`(?:^|[\\s,.;:!?'"()\\[\\]-])${escaped}(?:$|[\\s,.;:!?'"()\\[\\]-])`, 'i').test(
      ` ${haystack} `
    );
  }
  return haystack.includes(cue);
}

export function assessMirrorSafetyLevel(entries: SavedBehavioralEntry[]): SainaMirrorSafetyLevel {
  const haystack = collectCueText(entries);
  return assessMirrorSafetyHaystack(haystack);
}

function assessMirrorSafetyHaystack(haystack: string): SainaMirrorSafetyLevel {
  if (!haystack) return 'normal';
  if (RESTRICTED_CUES.some((c) => cueMatches(haystack, c))) return 'restricted';
  if (SENSITIVE_CUES.some((c) => cueMatches(haystack, c))) return 'sensitive';
  return 'normal';
}

/** Scan raw conversation text when cue hints are not yet materialized. */
export function assessMirrorSafetyFromTexts(texts: string[]): SainaMirrorSafetyLevel {
  const haystack = texts
    .map((text) => text.toLowerCase())
    .join(' ')
    .trim();
  return assessMirrorSafetyHaystack(haystack);
}

export const SAFE_METAPHOR_SCENE =
  'Abstract safe metaphor: quiet room, closed book on a table, distant warm light through a window, symbolic path fading into soft mist — no literal people, no text, no logos.';

export const SAFE_METAPHOR_KEYWORDS = [
  'quiet room',
  'closed book',
  'distant light',
  'symbolic path',
  'soft mist',
  'abstract metaphor',
];

export function applySafetyToScene(params: {
  safetyLevel: SainaMirrorSafetyLevel;
  sceneMetaphor: string;
  visualKeywords: string[];
}): { sceneMetaphor: string; visualKeywords: string[] } {
  if (params.safetyLevel === 'normal') {
    return { sceneMetaphor: params.sceneMetaphor, visualKeywords: params.visualKeywords };
  }
  return {
    sceneMetaphor: SAFE_METAPHOR_SCENE,
    visualKeywords: [...SAFE_METAPHOR_KEYWORDS],
  };
}
