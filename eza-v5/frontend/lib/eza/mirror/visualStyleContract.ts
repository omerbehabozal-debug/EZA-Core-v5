/**
 * EZA Mirror — professional visual style contract (textless scene layer only).
 * UI typography, metrics, and logos are rendered by the frontend card — never in the AI image.
 */

export const DEFAULT_ATMOSPHERE_LABEL = 'sakin, yumuşak, düşünsel atmosfer';

export const DEFAULT_EMOTION_LABEL = 'dengeli ve meraklı';

/** Core EZA visual identity appended to every scene prompt. */
export const EZA_VISUAL_STYLE_CONTRACT =
  'premium soft 3D illustration, cinematic but calm, elegant pastel color palette, warm natural light, refined character design, high detail but uncluttered, emotional storytelling scene, soft depth of field, polished product illustration, clean left side for UI overlay, vertical 9:16 friendly composition, no text, no typography, no letters, no numbers, no logo, no signage, no readable writing';

/** Standard negative prompt — quality and layout risks to avoid. */
export const STANDARD_NEGATIVE_PROMPT =
  'text, letters, numbers, logo, watermark, signage, readable writing, captions, UI labels, distorted anatomy, extra limbs, broken hands, creepy face, messy background, cluttered dashboard, harsh contrast, dark gaming card style, low quality, blurry, noisy, flat cartoon, cheap sticker style, over saturated colors';

/** Layout rules for Daily Mirror card overlay zones. */
export const PROMPT_COMPOSITION_RULES = [
  'main character on the right side or right-center of the frame',
  'left upper and left-middle areas clean and low-detail for text overlay',
  'lower third calmer with softer detail for UI card overlay',
  'uncluttered scene with one clear emotional main character',
  'environment reflects topic mood without visual clutter',
  'no text',
  'no typography',
  'no letters',
  'no numbers',
  'no logo',
  'no UI labels',
  'no signage',
  'no readable writing',
];

/** Shared character design language across EZA Mirror personas. */
export const CHARACTER_VISUAL_TRAITS = [
  'friendly',
  'intelligent',
  'warm',
  'non-creepy',
  'expressive eyes',
  'premium mascot-like but not childish',
  'high quality 3D illustration',
] as const;

/** Hints for downstream image APIs (also surfaced in debug payload). */
export const VISUAL_QUALITY_HINTS = [
  'professional premium product illustration',
  'pastel cinematic lighting',
  'soft depth of field',
  'textless scene only — all card copy rendered in frontend',
  '9:16 vertical safe composition',
  'left overlay zone kept clean',
] as const;

export const STYLE_PRESET = 'eza_mirror_professional_v1';

export function buildCharacterPresencePhrase(characterName: string): string {
  const traits = CHARACTER_VISUAL_TRAITS.join(', ');
  const name = characterName.trim() || 'EZA companion';
  return `${traits}, character presence inspired by ${name} behavior pattern, not topic-driven character design`;
}
