/**
 * Mirror V2 — approved cinematic poster copy contract.
 * No coaching, no dashboard language, no literal keyword illustration.
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';

export const MIRROR_TITLE_MAX_WORDS = 8;
export const MIRROR_TEXT_MIN_WORDS = 20;
export const MIRROR_TEXT_MAX_WORDS = 45;
export const MIRROR_CLOSING_MAX_WORDS = 10;

const COACHING_PHRASE =
  /yarın için|ipucu|unutma|kaçma|hedef(?:ler)?|öneri|tavsiye|çalış|dene\b|should\b|try to|don't\b|motivasyon|gelişim planı|kendini geliştir|bugün görünen desen|pattern card|coaching/i;

const DASHBOARD_PHRASE =
  /bugün görünen desen|yarın için ipucu|ilişki ritmi|sen\s*\d+|ai\s*\d+|güçleniyor|dengeleniyor/i;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ');
}

export function sanitizeCinematicCopy(text: string): string {
  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .trim();

  if (COACHING_PHRASE.test(cleaned) || DASHBOARD_PHRASE.test(cleaned)) {
    return '';
  }

  cleaned = cleaned
    .replace(/\b(?:ama aslında|aslında),?\s*/gi, '')
    .replace(/\b(?:bugün|konuşman|sohbetin)\s+/gi, (match, offset) =>
      offset === 0 ? match : match
    )
    .trim();

  return cleaned;
}

export function polishMirrorTitle(title: string): string {
  const trimmed = sanitizeCinematicCopy(title) || title.trim();
  return clampWords(trimmed, MIRROR_TITLE_MAX_WORDS);
}

export function polishMirrorText(text: string): string {
  const sanitized = sanitizeCinematicCopy(text);
  const base = sanitized || text.trim();
  const clamped = clampWords(base, MIRROR_TEXT_MAX_WORDS);
  if (countWords(clamped) < MIRROR_TEXT_MIN_WORDS && countWords(base) > MIRROR_TEXT_MAX_WORDS) {
    return clamped;
  }
  return clamped;
}

export function polishClosingLine(line: string | undefined): string | undefined {
  if (!line?.trim()) return undefined;
  const sanitized = sanitizeCinematicCopy(line);
  if (!sanitized) return undefined;
  const clamped = clampWords(sanitized, MIRROR_CLOSING_MAX_WORDS);
  return clamped || undefined;
}

/** Emotional atmosphere tokens — never literal place/product names for image gen. */
export function toEmotionalAtmosphere(keywords: readonly string[]): string[] {
  const abstract = new Set<string>();
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (
      /japan|japonya|tokyo|kyoto|fuji|pagoda|kimono|bmw|mercedes|toothpaste|diş|baklava|robot|hologram|dashboard|chart|score/.test(
        k
      )
    ) {
      continue;
    }
    abstract.add(kw);
  }
  return Array.from(abstract).slice(0, 6);
}

export function polishMirrorPayloadCopy(
  payload: Pick<
    SainaMirrorPayload,
    'mirrorTitle' | 'mirrorText' | 'closingLine' | 'visualKeywords' | 'sceneMetaphor'
  >
): Pick<
  SainaMirrorPayload,
  'mirrorTitle' | 'mirrorText' | 'closingLine' | 'visualKeywords' | 'sceneMetaphor'
> {
  return {
    mirrorTitle: polishMirrorTitle(payload.mirrorTitle),
    mirrorText: polishMirrorText(payload.mirrorText),
    closingLine: polishClosingLine(payload.closingLine),
    visualKeywords: toEmotionalAtmosphere(payload.visualKeywords),
    sceneMetaphor: payload.sceneMetaphor.trim(),
  };
}
