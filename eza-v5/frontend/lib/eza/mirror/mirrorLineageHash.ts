/**
 * Minimal lineage hashing for Mirror Phase 0 observability.
 * Matches backend interpretation_hash join shape for cross-layer comparison.
 *
 * Prefer Web Crypto SHA-256; fall back to deterministic DJB2 when SubtleCrypto
 * is unavailable (some CI / Vitest node environments).
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Sync DJB2 hex for lightweight fingerprints / SubtleCrypto fallback. */
export function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Expand DJB2 into a stable 64-char hex stand-in when SHA-256 is unavailable.
 * Not cryptographically strong — lineage comparison only.
 */
function djb2HexExpanded(input: string): string {
  const parts: string[] = [];
  let cursor = input;
  for (let i = 0; i < 8; i += 1) {
    parts.push(djb2Hex(`${i}:${cursor}`));
    cursor = `${parts[parts.length - 1]}:${cursor.length}`;
  }
  return parts.join('');
}

/** SHA-256 hex when available; otherwise expanded DJB2. */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const data = new TextEncoder().encode(input);
      const digest = await subtle.digest('SHA-256', data);
      return toHex(digest);
    } catch {
      // fall through
    }
  }
  return djb2HexExpanded(input);
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

export type MirrorSemanticSource =
  | 'd2_interpretation'
  | 'heuristic_fallback'
  | 'safe_fallback'
  | 'legacy_v3_fallback';

export type MirrorPublishLineageMeta = {
  semanticSource: MirrorSemanticSource;
  interpretationHash?: string;
  mappedPromptHash?: string;
  publishBundleHash?: string;
  publicLandingHash?: string;
  contentHash?: string | null;
  mapperVersion?: string;
  generationId?: string;
  /** Epoch ms when this generation was accepted client-side. */
  generationAcceptedAt?: number;
  /** Prior generationId this publish replaces (Yeni Sahne / Aynayı Güncelle). */
  replacesGenerationId?: string;
  forceRepublish?: boolean;
  conversationId?: string;
  sceneAssetId?: string | null;
  contractVersion?: string;
};
