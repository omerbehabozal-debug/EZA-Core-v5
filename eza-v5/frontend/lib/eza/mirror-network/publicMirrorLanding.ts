/**
 * Public Mirror Landing v1 — visible title/summary + continuation context.
 *
 * Privacy: not a conversation transcript.
 * Semantics: must explain why the image belongs to this Mirror's curiosity.
 * Authority: finalInterpretation (D2) only — never V3 evidence labels / subtopics.
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import { interpretationHashSync, sha256Hex } from '@/lib/eza/mirror/mirrorLineageHash';

export const MIRROR_PUBLIC_LANDING_CONTRACT_VERSION = 'mirror-public-landing-v1' as const;

export type PublicMirrorLandingSemanticSource =
  | 'd2_interpretation'
  | 'safe_fallback';

export type PublicMirrorLanding = {
  publicTitle: string;
  publicSummary: string;
  continuationContext: string;
  topicCategory: string;
  semanticSource: PublicMirrorLandingSemanticSource;
  interpretationHash: string;
  generationId?: string;
  contractVersion: typeof MIRROR_PUBLIC_LANDING_CONTRACT_VERSION;
  publicLandingHash?: string;
  isFallback?: boolean;
};

export const SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY =
  'Bu Ayna, paylaşılan bir deneyim ve onun uyandırdığı meraktan doğdu.';

export const SAFE_PUBLIC_LANDING_FALLBACK_TITLE = 'Paylaşılan Merak';

export const SAFE_CONTINUATION_CONTEXT =
  'Bu Ayna’daki merak alanını kendi sorularınla sürdürmek istiyorsun.';

/** Phrases from the old anti-summary gateway — never emit on new landings. */
export const FORBIDDEN_PUBLIC_LANDING_PHRASES = [
  'güvenli bir giriş kapısıdır',
  'konuşmayı yeniden anlatmaz',
  'sohbeti yeniden anlatmaz',
  'bu merak alanı',
] as const;

/**
 * Internal V3 taxonomy / evidence labels — never interpolate into publicSummary.
 * Genuine architecture interpretations may still describe materials in prose;
 * these exact label strings are banned as copy-paste taxonomy.
 */
export const FORBIDDEN_INTERNAL_LABELS = [
  'Cephe malzemesi',
  'Malzeme seçimi',
  'Işık ve gölge',
  'Mimari eskiz',
  'Cephe kararı',
  'Malzeme ve oran',
  'facade_material',
  'vehicle_compare',
  'japan_travel',
] as const;

const SUMMARY_MIN = 80;
const SUMMARY_MAX = 320;
const TITLE_MAX = 64;

function clean(text: string, max = 280): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function firstSentence(text: string, max = 160): string {
  const normalized = clean(text, 500);
  const match = normalized.match(/^(.+?[.!?…])(\s|$)/);
  return clean(match?.[1] ?? normalized, max);
}

function stripForbiddenPhrases(text: string): string {
  let out = text;
  for (const phrase of FORBIDDEN_PUBLIC_LANDING_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '');
  }
  return clean(out.replace(/\s{2,}/g, ' ').replace(/^[,;:\-–—]\s*/, ''));
}

export function publicSummaryContainsForbiddenContent(text: string): boolean {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PUBLIC_LANDING_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return true;
  }
  for (const label of FORBIDDEN_INTERNAL_LABELS) {
    if (text.includes(label)) return true;
  }
  return false;
}

export function isLegacyAntiSummaryLandingCopy(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('güvenli bir giriş kapısıdır') ||
    lower.includes('konuşmayı yeniden anlatmaz') ||
    lower.includes('sohbeti yeniden anlatmaz') ||
    /bu merak alanı,\s*.+üzerine doğmuş/i.test(text)
  );
}

function polishTitle(raw: string): string {
  const title = clean(raw, TITLE_MAX);
  if (!title) return SAFE_PUBLIC_LANDING_FALLBACK_TITLE;
  // Prefer 3–7 words when possible without inventing content.
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 10) return words.slice(0, 8).join(' ');
  return title;
}

/**
 * Deterministic public summary from D2 fields only.
 * Sentence 1 ≈ concrete scene (visualNarrative).
 * Sentence 2 ≈ curiosity (interpretationSummary / imageIntent).
 */
export function buildPublicSummaryFromInterpretation(
  interpretation: MirrorInterpretationV1
): string {
  const scene = firstSentence(interpretation.visualNarrative, 170);
  const curiosityRaw =
    clean(interpretation.interpretationSummary, 180) ||
    clean(interpretation.imageIntent, 160);
  let curiosity = firstSentence(curiosityRaw, 150);

  // Avoid duplicating scene wording in sentence 2.
  if (curiosity && scene && curiosity.toLowerCase().startsWith(scene.toLowerCase().slice(0, 24))) {
    curiosity = firstSentence(interpretation.imageIntent, 140);
  }

  let summary: string;
  if (scene && curiosity && scene.toLowerCase() !== curiosity.toLowerCase()) {
    const c2 = curiosity.endsWith('.') ? curiosity : `${curiosity.replace(/\.$/, '')}.`;
    // Lead curiosity with “Bu Ayna” only when summary is abstract; keep natural prose.
    const curiositySentence = /^(bu ayna|this mirror)\b/i.test(c2)
      ? c2
      : `Bu Ayna, ${c2.charAt(0).toLowerCase()}${c2.slice(1)}`;
    summary = `${scene.endsWith('.') ? scene : `${scene}.`} ${curiositySentence}`;
  } else if (scene) {
    summary = scene.endsWith('.') ? scene : `${scene}.`;
  } else if (curiosity) {
    summary = curiosity.endsWith('.') ? curiosity : `${curiosity}.`;
  } else {
    summary = SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY;
  }

  summary = stripForbiddenPhrases(summary);
  if (summary.length < SUMMARY_MIN && interpretation.atmosphereHint?.trim()) {
    const hint = clean(interpretation.atmosphereHint, 80);
    summary = clean(`${summary} ${hint}.`, SUMMARY_MAX);
  }
  summary = clean(summary, SUMMARY_MAX);

  if (!summary || publicSummaryContainsForbiddenContent(summary)) {
    return SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY;
  }
  return summary;
}

export function buildContinuationContextFromInterpretation(
  interpretation: MirrorInterpretationV1
): string {
  const intent = clean(interpretation.imageIntent, 200);
  const summary = clean(interpretation.interpretationSummary, 180);
  const base = intent || summary;
  if (!base) return SAFE_CONTINUATION_CONTEXT;
  const line = base.endsWith('.') ? base.slice(0, -1) : base;
  return clean(
    `${line} üzerine konuşmayı sürdür; turistik klişelerden uzak, yerel ve kişisel bir merakla devam et.`,
    280
  );
}

export function buildPublicMirrorLandingFromInterpretation(
  interpretation: MirrorInterpretationV1,
  options?: { generationId?: string }
): PublicMirrorLanding {
  const publicTitle = polishTitle(interpretation.title);
  const publicSummary = buildPublicSummaryFromInterpretation(interpretation);
  const continuationContext = buildContinuationContextFromInterpretation(interpretation);
  const topicCategory = clean(interpretation.topicCategory || 'general_curiosity', 48);
  const interpretationHash = interpretationHashSync(interpretation);

  return {
    publicTitle,
    publicSummary,
    continuationContext,
    topicCategory,
    semanticSource: 'd2_interpretation',
    interpretationHash,
    generationId: options?.generationId,
    contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
    isFallback: false,
  };
}

export function buildSafePublicMirrorLandingFallback(options?: {
  title?: string;
  generationId?: string;
}): PublicMirrorLanding {
  return {
    publicTitle: polishTitle(options?.title || SAFE_PUBLIC_LANDING_FALLBACK_TITLE),
    publicSummary: SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY,
    continuationContext: SAFE_CONTINUATION_CONTEXT,
    topicCategory: 'general_curiosity',
    semanticSource: 'safe_fallback',
    interpretationHash: 'none',
    generationId: options?.generationId,
    contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
    isFallback: true,
  };
}

export async function hashPublicMirrorLanding(
  landing: Pick<PublicMirrorLanding, 'publicTitle' | 'publicSummary' | 'continuationContext' | 'contractVersion'>
): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      publicTitle: landing.publicTitle,
      publicSummary: landing.publicSummary,
      continuationContext: landing.continuationContext,
      contractVersion: landing.contractVersion,
    })
  );
}

export function assertPublicLandingPublishable(landing: PublicMirrorLanding): void {
  if (!landing.publicTitle.trim()) {
    throw new Error('public_landing_title_required');
  }
  if (!landing.publicSummary.trim()) {
    throw new Error('public_landing_summary_required');
  }
  if (publicSummaryContainsForbiddenContent(landing.publicSummary)) {
    throw new Error('public_landing_forbidden_content');
  }
  if (landing.semanticSource === 'd2_interpretation' && landing.interpretationHash === 'none') {
    throw new Error('public_landing_interpretation_hash_required');
  }
}

/**
 * Semantic consistency: scene prompt + landing must share interpretation hash when both present.
 */
export function assertLandingMatchesInterpretationHash(
  landing: PublicMirrorLanding,
  expectedInterpretationHash: string | null | undefined
): void {
  if (!expectedInterpretationHash || landing.semanticSource !== 'd2_interpretation') return;
  if (landing.interpretationHash !== expectedInterpretationHash) {
    // Sync DJB2 vs async SHA may differ — compare only when both are sync-style short or equal length.
    // Publish path uses SHA for lineage; landing stores sync hash for card state.
    // Cross-check is soft when lengths differ (8 vs 64).
    if (
      expectedInterpretationHash.length === landing.interpretationHash.length &&
      expectedInterpretationHash !== landing.interpretationHash
    ) {
      throw new Error('public_landing_interpretation_mismatch');
    }
  }
}

export function pickVisibleLandingTitle(payload: {
  publicTitle?: string | null;
  cardTitle?: string | null;
}): string {
  return (
    payload.publicTitle?.trim() ||
    payload.cardTitle?.trim() ||
    SAFE_PUBLIC_LANDING_FALLBACK_TITLE
  );
}

export function pickVisibleLandingSummary(payload: {
  publicSummary?: string | null;
  curiosityContext?: string | null;
  landingContext?: string | null;
}): string {
  const preferred = payload.publicSummary?.trim();
  if (preferred && !isLegacyAntiSummaryLandingCopy(preferred)) return preferred;

  const legacy =
    payload.curiosityContext?.trim() || payload.landingContext?.trim() || '';
  if (legacy && !isLegacyAntiSummaryLandingCopy(legacy)) return legacy;

  // Legacy anti-summary or empty → safe fallback for display (migration surface).
  return SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY;
}
