/**
 * Minimal lineage hashing for Mirror Phase 0 observability.
 * Matches backend interpretation_hash join shape for cross-layer comparison.
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-256 hex — browser / Node 18+ (Vitest). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/** Sync DJB2 hex for lightweight bundle fingerprints when async is unavailable. */
export function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Same field join as backend `interpretation_hash`. */
export function interpretationHashPayload(interpretation: MirrorInterpretationV1): string {
  return [
    interpretation.title,
    interpretation.imageIntent,
    interpretation.visualNarrative,
    interpretation.interpretationSummary,
  ].join('|');
}

export async function interpretationHash(
  interpretation: MirrorInterpretationV1
): Promise<string> {
  return sha256Hex(interpretationHashPayload(interpretation));
}

/** Sync variant used inside sync builders; prefer async at publish boundary. */
export function interpretationHashSync(interpretation: MirrorInterpretationV1): string {
  return djb2Hex(interpretationHashPayload(interpretation));
}

export async function mappedPromptHash(prompt: string): Promise<string> {
  return sha256Hex((prompt || '').trim());
}

export async function publishBundleHash(bundle: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(bundle ?? {}));
}

export type MirrorSemanticSource = 'd2_interpretation' | 'legacy_v3_fallback';

export type MirrorPublishLineageMeta = {
  semanticSource: MirrorSemanticSource;
  interpretationHash?: string;
  mappedPromptHash?: string;
  publishBundleHash?: string;
  contentHash?: string | null;
  mapperVersion?: string;
  generationId?: string;
  conversationId?: string;
  sceneAssetId?: string | null;
};
