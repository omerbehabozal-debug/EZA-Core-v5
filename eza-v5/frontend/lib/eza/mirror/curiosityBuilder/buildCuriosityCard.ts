/**
 * Mirror V6 — Curiosity Builder
 *
 * Semantic Anchors → Curiosity Builder → Public Landing
 *
 * Inputs: D2 interpretation + Semantic Anchors only.
 * Never: V3 curiosity, CATEGORY labels, cluster names, headline fallback, storySummary.
 *
 * Output: publicTitle, publicSummary, continuationContext
 * Then Click Test; one alternate regenerate on fail.
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import { runCuriosityClickTest } from '@/lib/eza/mirror/curiosityBuilder/clickTest';
import type {
  CuriosityBuilderLocale,
  CuriosityBuilderOutput,
} from '@/lib/eza/mirror/curiosityBuilder/types';
import { MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION } from '@/lib/eza/mirror/curiosityBuilder/types';

export type BuildCuriosityCardInput = {
  anchors: MirrorSemanticAnchorsV1;
  /** D2 only — used sparingly when anchors are sparse; never V3 fields. */
  interpretation?: Pick<
    MirrorInterpretationV1,
    'title' | 'interpretationSummary' | 'imageIntent' | 'atmosphereHint'
  > | null;
  locale?: string | null;
};

function resolveLocale(locale?: string | null): CuriosityBuilderLocale {
  const raw = (locale || 'tr').trim().toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ar')) return 'ar';
  return 'tr';
}

function clean(text: string, max = 280): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Never cut mid-word — prefer a shorter complete phrase. */
export function clampAtWordBoundary(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  const window = normalized.slice(0, maxChars + 1);
  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace >= Math.max(8, Math.floor(maxChars * 0.35))) {
    return window.slice(0, lastSpace).trim();
  }
  const fallback = window.replace(/\s+\S*$/, '').trim();
  return fallback || normalized.slice(0, maxChars).trim();
}

const INCOMPLETE_TAIL =
  /(^|\s)(ve|ile|bir|çok|daha|nasıl|ne|için|olan|olacağını|olacak|olacağ|ed|et|mi|mı|mu|mü|the|a|an|of|or|to|and|farklı)$/i;

const DANGLING_POSSESSIVE = /(nın|nin|nun|nün|ımın|imin|umun|ümün)$/i;

/** True when a phrase looks mid-thought / mechanically truncated. */
export function endsIncompletely(phrase: string): boolean {
  const raw = phrase.replace(/\s+/g, ' ').trim();
  const hadTerminal = /[?？!.…)]$/.test(raw);
  const t = raw
    .replace(/[?？!.…]+$/g, '')
    .replace(/\s+(mi|mı|mu|mü)$/i, '')
    .trim();
  if (!t) return true;
  if (INCOMPLETE_TAIL.test(t)) return true;
  if (DANGLING_POSSESSIVE.test(t)) return true;
  const last = t.split(/\s+/).pop() || '';
  // Orphan 1–2 letter tokens (e.g. "ed") after a hard cut.
  if (last.length <= 2) return true;
  // Long run with no terminal punctuation — likely a sliced lead,
  // unless it ends on a substantial content word (complete theme phrase).
  if (!hadTerminal && t.length >= 48) {
    if (
      last.length >= 4 &&
      !INCOMPLETE_TAIL.test(last) &&
      !DANGLING_POSSESSIVE.test(t)
    ) {
      return false;
    }
    return true;
  }
  return false;
}

function healIncompletePhrase(phrase: string): string {
  let words = phrase.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  while (words.length > 2 && endsIncompletely(words.join(' '))) {
    words = words.slice(0, -1);
  }
  return words.join(' ');
}

function ensurePeriod(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (/[.!?…]$/.test(t)) return t;
  return `${t}.`;
}

/**
 * Prefer ≤maxWords when the result stays a complete thought.
 * Never blindly keep a broken N-word prefix.
 */
function titleWordClampComplete(
  title: string,
  maxWords = 8,
  maxChars = 64
): string {
  const words = title.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  let n = Math.min(maxWords, words.length);
  while (n >= 3) {
    const candidate = clampAtWordBoundary(words.slice(0, n).join(' '), maxChars);
    const healed = healIncompletePhrase(candidate);
    if (healed && !endsIncompletely(healed)) return healed;
    n -= 1;
  }
  const short = healIncompletePhrase(
    clampAtWordBoundary(words.slice(0, Math.min(maxWords, words.length)).join(' '), maxChars)
  );
  return short && !endsIncompletely(short) ? short : '';
}

/** Legacy name kept for hand-authored short titles (SUV/Mardin drafts). */
function titleWordClamp(title: string, maxWords = 8): string {
  return titleWordClampComplete(title, maxWords, 64) || healIncompletePhrase(title);
}


const PRODUCT_META_PREFIX =
  /^(bu ayna|bu mirror|this mirror|bu yansı|this reflection|bu sohbet|this conversation)[\s,:'’\-–—]*/i;

function stripProductMeta(text: string): string {
  let out = clean(text, 280);
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(PRODUCT_META_PREFIX, '').trim();
    if (next === out) break;
    out = next;
  }
  return out.replace(/^(ve|ile|için|of|the)\s+/i, '').trim();
}

function looksLikeQuestion(text: string): boolean {
  return (
    /[?？]/.test(text) ||
    /^(neden|niçin|nasıl|why|how)\b/i.test(text) ||
    /\b(mi|mı|mu|mü)\b/i.test(text)
  );
}

function asEditorialTitle(
  raw: string,
  locale: CuriosityBuilderLocale,
  criteria?: string,
  authorities?: TitleAuthorities
): string {
  return composeCompleteTitle(raw, locale, criteria, authorities);
}

export type TitleAuthorities = {
  interpretationSummary?: string | null;
  topic?: string | null;
  userIntent?: string | null;
  question?: string | null;
};

function criteriaOnlyFallback(
  locale: CuriosityBuilderLocale,
  criteria?: string
): string {
  if (criteria && criteria.trim()) {
    return locale === 'en'
      ? `What decides it: ${criteria.trim()}?`
      : `${criteria.trim().charAt(0).toUpperCase()}${criteria.trim().slice(1)} mı?`;
  }
  return locale === 'en' ? 'What is actually at stake?' : 'Asıl gerilim nerede?';
}

function genericFallback(locale: CuriosityBuilderLocale): string {
  return locale === 'en' ? 'What is actually at stake?' : 'Asıl gerilim nerede?';
}

/** True when a title collapses to decision criteria alone (no primary subject). */
export function isCriteriaOnlyTitle(
  title: string,
  criteria?: string | null
): boolean {
  if (!criteria?.trim()) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[?,.!:;"""''—–-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const titleCore = norm(title)
    .replace(/\s+(mi|mı|mu|mü)$/i, '')
    .replace(/^(what decides it|asıl gerilim nerede)\s*/i, '')
    .trim();
  const criteriaCore = norm(criteria).replace(/\s+ve\s+/g, ' ');
  const criteriaTokens = criteriaCore
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t && !/^(ve|ile|and|or|the|a|an)$/i.test(t));
  const titleTokens = titleCore
    .split(/\s+/)
    .filter((t) => t && !/^(ve|ile|and|or|the|a|an|mi|mı|mu|mü)$/i.test(t));
  if (titleTokens.length === 0 || criteriaTokens.length === 0) return false;
  return titleTokens.every((t) => criteriaTokens.includes(t));
}

/**
 * Pull a complete theme phrase from interpretation prose / topic.
 * Drops trailing criterion commentary (", kararı …").
 * Rejects raw hard-cap title stubs; keeps complete prose themes near ≤64.
 */
function extractThemeFromSummary(
  summary: string | null | undefined,
  maxChars = 64
): string | null {
  if (!summary?.trim()) return null;
  let text = stripProductMeta(summary.replace(/\s+/g, ' ').trim());
  // Hard-capped topic/intent stubs lack clause structure; full D2 prose has it.
  if (
    looksLikeHardCharTruncation(text) &&
    !/,/.test(text) &&
    !/\s+ile\s+/i.test(text)
  ) {
    return null;
  }
  text = text.replace(/,?\s*kararı\s+.+$/i, '').trim();
  text = text.replace(/\s*[—–]\s*.+$/, '').trim();
  text = text.replace(/[.!?…]+$/g, '').trim();
  if (!text) return null;
  if (text.length <= maxChars) {
    if (endsIncompletely(text) || text.split(/\s+/).length < 3) return null;
    return text;
  }
  const clamped = clampAtWordBoundary(text, maxChars);
  const healed = healIncompletePhrase(clamped);
  if (!healed || endsIncompletely(healed)) return null;
  if (healed.split(/\s+/).length < 3) return null;
  return healed;
}

/** True when text looks like a mechanical ≤64-char hard-cap residue. */
function looksLikeHardCharTruncation(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/[.!?…)]$/.test(t)) return false;
  // Exact/near D2 title max with no terminal punctuation.
  if (t.length >= 58 && t.length <= 64) return true;
  // Orphan stub after a hard cut (e.g. trailing "ed").
  const last = t.split(/\s+/).pop() || '';
  if (last.length <= 2) return true;
  return false;
}

/**
 * First complete clause from a long question/intent.
 * Never mechanically slice a longer complete clause down into a broken title.
 */
function extractPrimaryClause(
  raw: string | null | undefined,
  maxChars = 64
): string | null {
  if (!raw?.trim()) return null;
  let text = stripProductMeta(raw.replace(/\s+/g, ' ').trim());
  if (looksLikeHardCharTruncation(text)) return null;
  text = text.split(/[;…]|(?:\s+[—–]\s+)/)[0]?.trim() || text;
  text = text.replace(/[.!?？]+$/g, '').trim();
  if (!text) return null;
  if (looksLikeHardCharTruncation(text)) return null;
  // Fits as-is — only accept if structurally complete.
  if (text.length <= maxChars) {
    const healed = healIncompletePhrase(text);
    if (!healed || endsIncompletely(healed)) return null;
    if (healed.split(/\s+/).length < 3) return null;
    return healed;
  }
  // Longer than the title budget: do not blind-slice; other authorities must win.
  return null;
}

function finalizeTitleCandidate(
  phrase: string,
  locale: CuriosityBuilderLocale,
  preferQuestionMark: boolean,
  criteria?: string
): string | null {
  let composed = titleWordClampComplete(phrase, 8, 64);
  if (
    !composed ||
    endsIncompletely(composed) ||
    composed.split(/\s+/).length < 3
  ) {
    return null;
  }
  if (isCriteriaOnlyTitle(composed, criteria)) return null;
  composed = `${composed.charAt(0).toUpperCase()}${composed.slice(1)}`;
  // Only mark interrogative phrases — do not force "?" onto noun-phrase themes.
  if (
    preferQuestionMark &&
    looksLikeQuestion(composed) &&
    !/[?？]$/.test(composed)
  ) {
    const withMark = clampAtWordBoundary(`${composed}?`, 64);
    const core = withMark.replace(/[?？]$/, '');
    if (!endsIncompletely(core) && !isCriteriaOnlyTitle(core, criteria)) {
      composed = withMark.endsWith('?') ? withMark : `${healIncompletePhrase(withMark)}?`;
    }
  }
  const out = clampAtWordBoundary(composed, 64);
  if (!out || endsIncompletely(out) || isCriteriaOnlyTitle(out, criteria)) {
    return null;
  }
  if (out.split(/\s+/).length < 3) return null;
  return out;
}

/**
 * Build a concise complete title within the 64-char contract.
 * Priority: central curiosity/topic → interpretation theme → question phrase
 * → criteria only as last resort. Never mid-word / mid-thought cuts.
 */
export function composeCompleteTitle(
  raw: string,
  locale: CuriosityBuilderLocale,
  criteria?: string,
  authorities?: TitleAuthorities
): string {
  const preferQ =
    looksLikeQuestion(raw) ||
    looksLikeQuestion(authorities?.question || '');

  const primarySources: Array<string | null | undefined> = [
    // 1. Complete central curiosity / topic (reject hard-cap residue)
    extractThemeFromSummary(authorities?.topic),
    extractPrimaryClause(authorities?.topic),
    // 2. Complete interpretation theme (recovers subject when topic is truncated)
    extractThemeFromSummary(authorities?.interpretationSummary),
    // 3. Question-derived editorial clause
    extractPrimaryClause(authorities?.question || raw),
    extractPrimaryClause(raw),
    // 4. Complete userIntent (never truncated mid-thought)
    extractThemeFromSummary(authorities?.userIntent),
    extractPrimaryClause(authorities?.userIntent),
  ];

  for (const source of primarySources) {
    if (!source) continue;
    const title = finalizeTitleCandidate(source, locale, preferQ, criteria);
    if (title) return title;
  }

  // Last resort only — never preferred when a primary subject exists above.
  const last =
    finalizeTitleCandidate(
      criteriaOnlyFallback(locale, criteria),
      locale,
      false,
      undefined
    ) ||
    finalizeTitleCandidate(genericFallback(locale), locale, false, undefined) ||
    genericFallback(locale);
  return clampAtWordBoundary(last, 64);
}

function isSafeSummaryLead(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || endsIncompletely(t)) return false;
  if (t.split(/\s+/).length < 4) return false;
  return true;
}

/** Prefer a complete first sentence / clause — never a mid-thought fragment. */
function takeSafeSummaryLead(text: string, maxChars = 140): string | null {
  const normalized = stripProductMeta((text || '').replace(/\s+/g, ' ').trim());
  if (!normalized) return null;
  const sentence = normalized.match(/^(.+?[.!?…])(\s|$)/);
  const candidate = healIncompletePhrase(
    clampAtWordBoundary(sentence?.[1] || normalized, maxChars)
  );
  if (!candidate || !isSafeSummaryLead(candidate)) return null;
  return candidate;
}

/** Semantic spoiler / conclusion disclosure — not a naive banned-word strip. */
const CONCLUSION_DISCLOSURE =
  /\b(gösteriyor|ortaya koyuyor|sonuç olarak|asıl neden|temel sebep|belirleyen şey|asıl sebep|the answer is|what (really )?decides|shows that|reveals that)\b/i;

const CONCLUSION_TAIL =
  /,?\s*kararı\s+.+$/i;

function disclosesConclusion(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (CONCLUSION_DISCLOSURE.test(t)) return true;
  if (/kararı\s+.+\s+belirle/i.test(t)) return true;
  if (/belirlediğini\s+göster/i.test(t)) return true;
  return false;
}

function stripConclusionClause(text: string): string {
  return stripProductMeta(text)
    .replace(CONCLUSION_TAIL, '')
    .replace(/\s+[—–-]\s*(asıl merak|the interesting part|kararı|what (really )?decides).+$/i, '')
    .replace(/\s+(gösteriyor|ortaya koyuyor)\.?$/i, '')
    .replace(/[.!?…]+$/g, '')
    .trim();
}

function normalizeCompareKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşüâîû\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** How much of the candidate's content words already appear in the title. */
function titleContentOverlap(title: string, candidate: string): number {
  const stop = new Set([
    've',
    'ile',
    'bir',
    'bu',
    'şu',
    'the',
    'a',
    'an',
    'of',
    'or',
    'and',
    'mi',
    'mı',
    'mu',
    'mü',
  ]);
  const titleTokens = new Set(
    normalizeCompareKey(title)
      .split(' ')
      .filter((w) => w.length > 2 && !stop.has(w))
  );
  const candTokens = normalizeCompareKey(candidate)
    .split(' ')
    .filter((w) => w.length > 2 && !stop.has(w));
  if (!titleTokens.size || !candTokens.length) return 0;
  const hits = candTokens.filter((w) => titleTokens.has(w)).length;
  return hits / candTokens.length;
}

/**
 * Conversation dimensions for the trailer — from anchors grounded in selected Q/A.
 * Prefer decisionCriteria + concrete scene cues; never invent themes.
 */
function pickConversationDimensions(
  anchors: MirrorSemanticAnchorsV1,
  max = 4
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const t = stripProductMeta((raw || '').replace(/\s+/g, ' ').trim());
    if (!t || t.length < 2 || t.length > 42) return;
    if (/^(vs|mü|mi|mu|mü)$/i.test(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  for (const c of anchors.decisionCriteria) {
    push(c);
    if (out.length >= max) return out;
  }
  for (const s of anchors.scene) {
    push(s);
    if (out.length >= max) return out;
  }
  for (const e of anchors.emotion) {
    push(e);
    if (out.length >= max) return out;
  }
  return out;
}

function formatDimensionList(
  dims: string[],
  locale: CuriosityBuilderLocale
): string {
  if (!dims.length) return '';
  if (locale === 'en') {
    if (dims.length === 1) return dims[0];
    if (dims.length === 2) return `${dims[0]} and ${dims[1]}`;
    return `${dims.slice(0, -1).join(', ')}, and ${dims[dims.length - 1]}`;
  }
  if (dims.length === 1) return dims[0];
  if (dims.length === 2) return `${dims[0]} ve ${dims[1]}`;
  return `${dims.slice(0, -1).join(', ')} ve ${dims[dims.length - 1]}`;
}

/** Ending lemma used to avoid "...X. ...X." adjacent sentence repetition. */
function sentenceEndingLemma(sentence: string): string {
  const last = (sentence || '')
    .replace(/[.!?…]+$/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .pop();
  if (!last) return '';
  return last
    .toLowerCase()
    .replace(/[^a-zçğıöşüâîû]/gi, '')
    .replace(/(iyor|ıyor|uyor|üyor|mekte|makta)$/i, '')
    .replace(/(ing|ed|es|s)$/i, '');
}

/**
 * Tension object for the trailer — subject of the conversation, never summary strategy.
 * Soft reframes "fark" → "mesafe" so the verb can land naturally (sorguluyor / questions).
 */
function curiosityTensionObject(
  anchors: MirrorSemanticAnchorsV1,
  title: string
): string {
  const candidates = [
    stripConclusionClause((anchors.topic || '').replace(/\s+/g, ' ').trim()),
    stripConclusionClause(
      (anchors.question || '').replace(/[?？]+$/g, '').replace(/\s+/g, ' ').trim()
    ),
  ].filter(Boolean);

  for (const raw of candidates) {
    let t = raw
      .replace(/\barasındaki\s+fark\b/gi, 'arasındaki mesafe')
      .replace(/\bthe\s+difference\s+between\b/gi, 'the distance between');
    if (/\bmesafe\b/i.test(t) && !/\bmesafeyi\b/i.test(t)) {
      t = t.replace(/\bmesafe\b/i, 'mesafeyi');
    }
    t = clampAtWordBoundary(t, 72);
    if (!t || endsIncompletely(t)) continue;
    // Prefer a candidate that is not a near-verbatim title restatement.
    if (titleContentOverlap(title, t) > 0.9 && candidates.length > 1) continue;
    return t;
  }
  // Last: accept first usable even if close to title — dimensions frame the sentence.
  for (const raw of candidates) {
    let t = raw
      .replace(/\barasındaki\s+fark\b/gi, 'arasındaki mesafe')
      .replace(/\bthe\s+difference\s+between\b/gi, 'the distance between');
    if (/\bmesafe\b/i.test(t) && !/\bmesafeyi\b/i.test(t)) {
      t = t.replace(/\bmesafe\b/i, 'mesafeyi');
    }
    t = clampAtWordBoundary(t, 72);
    if (t && !endsIncompletely(t)) return t;
  }
  return '';
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return `${text.charAt(0).toLocaleLowerCase('tr-TR')}${text.slice(1)}`;
}

/**
 * Clamp a mid-clause tension object without orphaning relational stems
 * (e.g. "…arasındaki" without its noun).
 */
function clampTensionForClause(text: string, maxChars = 88): string {
  let t = clampAtWordBoundary(text, maxChars);
  if (/(arasındaki|arasindaki|between)$/i.test(t)) {
    t = clampAtWordBoundary(text, maxChars + 20);
  }
  if (/(arasındaki|arasindaki)$/i.test(t) && /mesafe|fark/i.test(text)) {
    t = `${t} mesafeyi`;
  }
  return t;
}

function openCuriosityClose(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1,
  avoidLemma?: string
): string {
  if (locale === 'en') {
    const options = [
      'as it deepens, a more personal question comes into view',
      'the opening tension starts to feel different from another angle',
      'something quieter and closer begins to matter',
    ];
    if (anchors.place && variant === 0) {
      return 'the local evening starts to feel more personal than scenic';
    }
    const picked = options[variant % options.length];
    if (avoidLemma && sentenceEndingLemma(picked) === avoidLemma) {
      return options[(variant + 1) % options.length];
    }
    return picked;
  }
  const options = [
    'derinleştikçe daha kişisel bir sorunun kapısını aralıyor',
    'başlangıçtaki gerilim başka bir açıdan yeniden beliriyor',
    'beklenmedik bir noktaya dokunuyor',
  ];
  if (anchors.place && variant === 0) {
    return 'yerel bir akşam daha kişisel bir tona kayıyor';
  }
  const picked = options[variant % options.length];
  if (avoidLemma && sentenceEndingLemma(picked) === avoidLemma) {
    return options[(variant + 1) % options.length];
  }
  return picked;
}

/**
 * Editorial scrub: prose must never describe the summarizer's anti-spoiler strategy.
 * Generation avoids these phrases; this is a safety net, not the primary control.
 */
function scrubMetaSummaryStrategy(text: string): string {
  return text
    .replace(
      /,?\s*cevabı\s+(kilitlemeden|vermeden|açık\s+etmeden)\b/gi,
      ''
    )
    .replace(
      /,?\s*sonucu\s+(söylemeden|açıklamadan)\b/gi,
      ''
    )
    .replace(/,?\s*spoiler\s+vermeden\b/gi, '')
    .replace(/,?\s*merakı\s+koruyarak\b/gi, '')
    .replace(/,?\s*açık\s+uç\s+bırakarak\b/gi, '')
    .replace(
      /\bwithout\s+(closing|locking|settling)\s+(the\s+)?(answer|it|a\s+verdict)\b/gi,
      ''
    )
    .replace(/\brather\s+than\s+(delivering|locking)\s+(a\s+)?(verdict|answer)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

/**
 * Curiosity trailer summary: territory + development, not the conclusion.
 * ~2 sentences; talks about the subject/conversation — never summarization strategy.
 */
export function buildCuriosityTrailerSummary(input: {
  anchors: MirrorSemanticAnchorsV1;
  title: string;
  interpretationSummary?: string | null;
  locale: CuriosityBuilderLocale;
  variant?: 0 | 1;
}): string {
  const locale = input.locale;
  const variant = input.variant === 1 ? 1 : 0;
  const dims = pickConversationDimensions(input.anchors, 4);
  const dimPhrase = formatDimensionList(
    dims.slice(0, Math.min(4, Math.max(2, dims.length) || dims.length)),
    locale
  );

  const tension = curiosityTensionObject(input.anchors, input.title);

  let softLead = takeSafeSummaryLead(input.interpretationSummary || '');
  if (softLead) {
    softLead = stripConclusionClause(softLead);
    if (
      !softLead ||
      disclosesConclusion(softLead) ||
      titleContentOverlap(input.title, softLead) > 0.72 ||
      /cevabı\s+(kilitlemeden|vermeden)|sonucu\s+(söylemeden|açıklamadan)/i.test(
        softLead
      )
    ) {
      softLead = null;
    }
  }

  const dimLeadTr = dimPhrase
    ? `${dimPhrase.charAt(0).toUpperCase()}${dimPhrase.slice(1)} üzerine başlayan bu sohbet`
    : '';

  let first: string;
  if (locale === 'en') {
    if (dimPhrase && tension) {
      first = `A conversation that opens around ${dimPhrase} questions ${clampTensionForClause(lowerFirst(tension))}`;
    } else if (dimPhrase) {
      first = `A conversation that opens around ${dimPhrase} carries a quieter personal tension`;
    } else if (softLead) {
      first = softLead;
    } else if (tension) {
      first = `The exchange turns on ${clampTensionForClause(lowerFirst(tension))}`;
    } else {
      first = `The conversation leans into a more personal tension`;
    }
  } else if (dimLeadTr && tension) {
    first = `${dimLeadTr}, ${clampTensionForClause(lowerFirst(tension))} sorguluyor`;
  } else if (dimLeadTr) {
    first = `${dimLeadTr} daha kişisel bir gerilim taşıyor`;
  } else if (softLead) {
    first = softLead;
  } else if (tension) {
    first = `Bu sohbet, ${clampTensionForClause(lowerFirst(tension))} sorguluyor`;
  } else {
    first = `Bu sohbet daha kişisel bir gerilim taşıyor`;
  }

  first = healIncompletePhrase(
    scrubMetaSummaryStrategy(first.replace(/[.!?…]+$/g, '').trim())
  );
  const close = openCuriosityClose(
    input.anchors,
    locale,
    variant,
    sentenceEndingLemma(first)
  );
  let combined = ensurePeriod(
    scrubMetaSummaryStrategy(
      `${first}. ${close.charAt(0).toUpperCase()}${close.slice(1)}`
    )
  );
  combined = healIncompletePhrase(clampAtWordBoundary(combined, 300));
  if (!combined.endsWith('.') && !combined.endsWith('!') && !combined.endsWith('?')) {
    combined = ensurePeriod(combined);
  }

  // Prefer ~25–45 words when natural; compress via sentence-safe clamp if bloated.
  const words = combined.split(/\s+/).filter(Boolean);
  if (words.length > 48) {
    const cut = healIncompletePhrase(clampAtWordBoundary(combined, 220));
    combined = ensurePeriod(cut);
  }
  if (disclosesConclusion(combined)) {
    // Last-resort trailer from dimensions only — still subject-facing, not meta.
    const closeSafe = openCuriosityClose(input.anchors, locale, variant, 'sorgula');
    if (locale === 'en' && dimPhrase) {
      combined = ensurePeriod(
        `A conversation that opens around ${dimPhrase} carries a quieter personal tension. ${closeSafe.charAt(0).toUpperCase()}${closeSafe.slice(1)}`
      );
    } else if (dimLeadTr) {
      combined = ensurePeriod(
        `${dimLeadTr} daha kişisel bir gerilim taşıyor. ${closeSafe.charAt(0).toUpperCase()}${closeSafe.slice(1)}`
      );
    } else {
      combined = ensurePeriod(
        locale === 'en'
          ? `The conversation leans into a more personal tension. ${closeSafe.charAt(0).toUpperCase()}${closeSafe.slice(1)}`
          : `Bu sohbet daha kişisel bir gerilim taşıyor. ${closeSafe.charAt(0).toUpperCase()}${closeSafe.slice(1)}`
      );
    }
  }
  return scrubMetaSummaryStrategy(combined);
}

/**
 * @deprecated Prefer buildCuriosityTrailerSummary — kept for narrow internal fallbacks.
 */
function asEditorialSummary(
  intent: string,
  criteria: string,
  locale: CuriosityBuilderLocale,
  anchors?: MirrorSemanticAnchorsV1,
  title?: string
): string {
  if (anchors) {
    return buildCuriosityTrailerSummary({
      anchors,
      title: title || '',
      interpretationSummary: intent,
      locale,
      variant: 0,
    });
  }
  const body = stripConclusionClause(
    stripProductMeta(intent).replace(/\s*—\s*ilginç tarafı,.*$/i, '')
  );
  const completeBody = healIncompletePhrase(clampAtWordBoundary(body, 140));
  if (
    completeBody &&
    isSafeSummaryLead(completeBody) &&
    !disclosesConclusion(completeBody) &&
    !/düzgün bir etiket|ilginç tarafı/i.test(completeBody) &&
    !/(nın|nin|nun|nün)\s+\S+/i.test(completeBody)
  ) {
    return ensurePeriod(completeBody);
  }
  if (locale === 'en') {
    return ensurePeriod(
      `The live question turns on ${criteria} and leans into a quieter personal tension`
    );
  }
  return ensurePeriod(
    `${criteria.charAt(0).toUpperCase()}${criteria.slice(1)} üzerine açılan bu sohbet daha kişisel bir gerilim taşıyor`
  );
}


function criteriaPhrase(criteria: string[], locale: CuriosityBuilderLocale): string {
  const list = criteria.slice(0, 3);
  if (!list.length) return locale === 'en' ? 'feel and comfort' : 'his ve konfor';
  if (locale === 'en') return list.join(', ');
  return list.join(', ');
}

type Draft = {
  publicTitle: string;
  publicSummary: string;
  continuationContext: string;
};

function draftVehicleCompare(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft | null {
  const topic = (anchors.topic || '').toLowerCase();
  const blob = [
    anchors.topic,
    anchors.userIntent,
    anchors.question,
    ...anchors.decisionCriteria,
    ...anchors.scene,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isSuv =
    /bmw|x3|mercedes|glc/.test(topic) || /bmw|x3|mercedes|glc/.test(blob);
  if (!isSuv) return null;

  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);

  if (locale === 'en') {
    if (variant === 0) {
      return {
        publicTitle: titleWordClamp('BMW X3 or Mercedes GLC?'),
        publicSummary: ensurePeriod(
          `Between two family SUVs, the talk keeps circling ${criteria} without crowning a winner`
        ),
        continuationContext: clean(
          `Stay with the X3 vs GLC dilemma through ${criteria}; keep asking which cabin feels calmer on a long road.`,
          280
        ),
      };
    }
    return {
      publicTitle: titleWordClamp('Sporty feel or quiet ride?'),
      publicSummary: ensurePeriod(
        `The fork stays open: ${criteria} keep pulling without a neat brochure answer`
      ),
      continuationContext: clean(
        `Continue the family SUV fork: chase the quieter, more settled drive rather than a catalog duel.`,
        280
      ),
    };
  }

  // tr / ar (tr editorial for now)
  if (variant === 0) {
    return {
      publicTitle: titleWordClamp('BMW X3 mü Mercedes GLC mi?'),
      publicSummary: ensurePeriod(
        `Aile SUV’sinde ${criteria} üzerine başlayan bu sohbet, hangi kabinin daha huzurlu hissettirdiğini sorguluyor`
      ),
      continuationContext: clean(
        `X3 ile GLC ikileminde ${criteria} üzerinden devam et; katalog düellosu yerine uzun yolda hangi kabinin daha sakin kaldığını sor.`,
        280
      ),
    };
  }
  return {
    publicTitle: titleWordClamp('Sportif his mi huzurlu sürüş mü?'),
    publicSummary: ensurePeriod(
      `${criteria.charAt(0).toUpperCase()}${criteria.slice(1)} etrafında dönen bu seçim daha kişisel bir gerilim taşıyor`
    ),
    continuationContext: clean(
      `Aynı aile SUV ikileminde kal; sessizlik ve konfor üzerinden hangi aracın daha huzurlu sürdüğünü aç.`,
      280
    ),
  };
}

function draftPlaceEvening(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft | null {
  const place = anchors.place?.trim();
  if (!place) return null;

  const emotion = anchors.emotion.slice(0, 2).join(', ') || (locale === 'en' ? 'quiet' : 'sessiz');
  const localCue =
    anchors.scene.find((s) => /çay|sandalye|sokak|mahalle|chair|tea|street/i.test(s)) ||
    (locale === 'en' ? 'local street' : 'yerel sokak');

  if (locale === 'en') {
    if (variant === 0) {
      return {
        publicTitle: titleWordClamp(`${place}: tourist route or local dusk?`),
        publicSummary: ensurePeriod(
          `The pull is a ${emotion} evening on a real street — ${localCue} — not a postcard itinerary`
        ),
        continuationContext: clean(
          `Stay with ${place}’s local pace; keep asking what a quiet dusk feels like away from tourist routes.`,
          280
        ),
      };
    }
    return {
      publicTitle: titleWordClamp(`Why does ${place} feel this quiet?`),
      publicSummary: ensurePeriod(
        `Curiosity sits in the small pause — ${localCue} — where the city turns local instead of scenic`
      ),
      continuationContext: clean(
        `Continue the ${place} evening without postcard language; chase the lived neighborhood hush.`,
        280
      ),
    };
  }

  if (variant === 0) {
    return {
      publicTitle: titleWordClamp(`${place}'de turist mi yerel akşam mı?`),
      publicSummary: ensurePeriod(
        `Merak, kartpostal rota değil; ${emotion} bir mahalle anında — ${localCue} — şehrin nasıl yaşandığında`
      ),
      continuationContext: clean(
        `${place}’in yerel temposunda kal; turistik klişelerden uzak, sakin bir akşamın nasıl hissedildiğini sor.`,
        280
      ),
    };
  }
  return {
    publicTitle: titleWordClamp(`${place}'de neden bu kadar sessiz?`),
    publicSummary: ensurePeriod(
      `Asıl çekim, manzara listesi değil; ${localCue} ile açılan küçük bir durak — şehrin yerel hali`
    ),
    continuationContext: clean(
      `${place} akşamını kartpostal dilinden uzak tut; mahallenin kendi temposunu merak etmeye devam et.`,
      280
    ),
  };
}

function draftFromQuestion(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1,
  interpretation?: BuildCuriosityCardInput['interpretation']
): Draft | null {
  // Use full question text — never pre-slice to N chars mid-word.
  const qRaw = stripProductMeta((anchors.question || '').replace(/\s+/g, ' ').trim());
  if (!qRaw) return null;
  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);
  const authorities: TitleAuthorities = {
    interpretationSummary: interpretation?.interpretationSummary,
    topic: anchors.topic,
    userIntent: anchors.userIntent,
    question: qRaw,
  };
  const title = composeCompleteTitle(qRaw, locale, criteria, authorities);

  const summary = buildCuriosityTrailerSummary({
    anchors,
    title,
    interpretationSummary: interpretation?.interpretationSummary,
    locale,
    variant,
  });

  if (locale === 'en') {
    return {
      publicTitle: title,
      publicSummary: summary,
      continuationContext: clean(
        `Stay with “${clampAtWordBoundary(qRaw, 60)}”; keep pressure on ${criteria}.`,
        280
      ),
    };
  }

  return {
    publicTitle: title,
    publicSummary: summary,
    continuationContext: clean(
      `“${clampAtWordBoundary(qRaw, 60)}” sorusunda kal; ${criteria} üzerinden derinleştir.`,
      280
    ),
  };
}

function draftFromTopicOrIntent(
  anchors: MirrorSemanticAnchorsV1,
  interpretation: BuildCuriosityCardInput['interpretation'],
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft {
  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);
  const authorities: TitleAuthorities = {
    interpretationSummary: interpretation?.interpretationSummary,
    topic: anchors.topic,
    userIntent: anchors.userIntent,
    question: anchors.question,
  };
  const topic = asEditorialTitle(
    anchors.topic || interpretation?.title || '',
    locale,
    criteria,
    authorities
  );
  const intent = stripProductMeta(
    interpretation?.interpretationSummary || anchors.userIntent || ''
  );

  if (locale === 'en') {
    const title =
      variant === 0
        ? topic
        : asEditorialTitle(
            intent.split(/\s+/).slice(0, 6).join(' ') || topic,
            locale,
            criteria,
            authorities
          );
    return {
      publicTitle: title,
      publicSummary: asEditorialSummary(intent, criteria, locale, anchors, title),
      continuationContext: clean(
        `Continue the same curiosity: ${topic || intent || criteria}; stay human, not catalog.`,
        280
      ),
    };
  }

  const title =
    variant === 0
      ? topic
      : asEditorialTitle(
          intent.split(/\s+/).slice(0, 6).join(' ') || topic,
          locale,
          criteria,
          authorities
        );
  return {
    publicTitle: title,
    publicSummary: asEditorialSummary(intent, criteria, locale, anchors, title),
    continuationContext: clean(
      `Aynı merakı sürdür: ${topic || intent || criteria}; katalog dili değil, insanî gerilim.`,
      280
    ),
  };
}

function draftHumanCuriosity(
  anchors: MirrorSemanticAnchorsV1,
  interpretation: BuildCuriosityCardInput['interpretation'],
  locale: CuriosityBuilderLocale
): Draft {
  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);
  const question = stripProductMeta(anchors.question || '');
  const authorities: TitleAuthorities = {
    interpretationSummary: interpretation?.interpretationSummary,
    topic: anchors.topic,
    userIntent: anchors.userIntent,
    question: question || anchors.question,
  };
  const title = question
    ? composeCompleteTitle(question, locale, criteria, authorities)
    : asEditorialTitle(
        anchors.topic || interpretation?.title || '',
        locale,
        criteria,
        authorities
      );
  const summary = asEditorialSummary(
    interpretation?.interpretationSummary || anchors.userIntent || '',
    criteria,
    locale,
    anchors,
    title
  );
  return {
    publicTitle: title,
    publicSummary: summary,
    continuationContext: clean(
      locale === 'en'
        ? `Stay with ${title}; keep the question human.`
        : `${title} sorusunda kal; insanî meraktan ayrılma.`,
      280
    ),
  };
}

function buildDraft(
  input: BuildCuriosityCardInput,
  variant: 0 | 1
): Draft {
  const locale = resolveLocale(input.locale);
  const anchors = input.anchors;

  return (
    draftVehicleCompare(anchors, locale, variant) ||
    draftPlaceEvening(anchors, locale, variant) ||
    draftFromQuestion(anchors, locale, variant, input.interpretation) ||
    draftFromTopicOrIntent(anchors, input.interpretation, locale, variant)
  );
}

/**
 * Build editorial discover card from Semantic Anchors (+ optional D2 fields).
 * Runs Click Test; regenerates once on failure.
 */
export function buildCuriosityCard(input: BuildCuriosityCardInput): CuriosityBuilderOutput {
  const primary = buildDraft(input, 0);
  const primaryTest = runCuriosityClickTest(primary);

  if (primaryTest.passed) {
    return {
      contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
      ...primary,
      variant: 0,
      clickTestPassed: true,
      clickTestFailures: [],
    };
  }

  const alternate = buildDraft(input, 1);
  const altTest = runCuriosityClickTest(alternate);

  // Prefer alternate if it passes; otherwise keep primary but surface failures.
  if (altTest.passed) {
    return {
      contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
      ...alternate,
      variant: 1,
      clickTestPassed: true,
      clickTestFailures: primaryTest.failures,
    };
  }

  const human = draftHumanCuriosity(
    input.anchors,
    input.interpretation,
    resolveLocale(input.locale)
  );
  const humanTest = runCuriosityClickTest(human);
  return {
    contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
    ...human,
    variant: 1,
    clickTestPassed: humanTest.passed,
    clickTestFailures: Array.from(
      new Set([
        ...primaryTest.failures,
        ...altTest.failures,
        ...humanTest.failures,
      ])
    ),
  };
}

/** Same anchors → same curiosity card (deterministic). */
export function curiosityCardFingerprint(card: CuriosityBuilderOutput): string {
  return `${card.publicTitle}||${card.publicSummary}||${card.continuationContext}`;
}
