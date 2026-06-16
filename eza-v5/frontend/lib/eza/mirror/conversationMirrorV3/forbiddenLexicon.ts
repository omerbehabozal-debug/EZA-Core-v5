/**
 * V3 — phrases and concepts removed from the mirror architecture.
 */

export const FORBIDDEN_MIRROR_PHRASES = [
  'Bugün Görünen Desen',
  'Yarın İçin İpucu',
  'Bugün Ne Öğrendin',
  'Enerjin',
  'İlişki Ritmi',
  'Derinleşme',
  'Keşif',
  'Gelişim',
  'Bugün konuştun',
  'Bugün araştırdın',
  'Konuşman',
  'Sohbetin',
] as const;

export const FORBIDDEN_MIRROR_CONCEPTS = [
  'panda',
  'fox',
  'deer',
  'owl',
  'turtle',
  'archetype',
  'character engine',
  'relationship score',
  'growth score',
  'energy score',
  'discovery score',
  'exploration score',
  'balance score',
  'progress bar',
  'analytics card',
  'dashboard',
  'insight widget',
  'coaching',
  'self-help',
] as const;

export function containsForbiddenMirrorPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_MIRROR_PHRASES.some((phrase) =>
    lower.includes(phrase.toLowerCase())
  );
}
