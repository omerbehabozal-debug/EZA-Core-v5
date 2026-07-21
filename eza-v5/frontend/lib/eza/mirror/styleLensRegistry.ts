/**
 * P4-C5 — Style Lens registry (legacy catalog).
 * Prompt injection into generate-scene is retired — see styleLensPrompt.ts.
 * IDs may still appear in localStorage sessions; they no longer affect OpenAI prompts.
 */

export type StyleLensId =
  | 'premium_human'
  | 'curious_panda'
  | 'cinematic_no_character'
  | 'explorer_fox'
  | 'wise_owl'
  | 'vintage_editorial'
  | 'watercolor_editorial'
  | 'minimal_poetic';

export interface StyleLens {
  id: StyleLensId;
  label: string;
  shortLabel: string;
  plusOnly: boolean;
  promptBlock: string;
  negativeAdditions?: string;
}

export const DEFAULT_STYLE_LENS_ID: StyleLensId = 'premium_human';

/** Plus rotation order for “Yeni Sahne Oluştur”. */
export const STYLE_LENS_PLUS_CYCLE: readonly StyleLensId[] = [
  'premium_human',
  'curious_panda',
  'cinematic_no_character',
  'explorer_fox',
  'wise_owl',
  'vintage_editorial',
  'watercolor_editorial',
  'minimal_poetic',
] as const;

const UNIVERSAL_STYLE_NEGATIVE =
  'sticker, emoji, cute mascot, toy character, children book illustration, chibi, kawaii, plush toy, game character, costume mascot, cheap clipart';

export const STYLE_LENS_REGISTRY: Record<StyleLensId, StyleLens> = {
  premium_human: {
    id: 'premium_human',
    label: 'Premium İnsan',
    shortLabel: 'Sinematik',
    plusOnly: false,
    promptBlock: [
      'style lens:',
      'cinematic real human subject or believable human-scale editorial figure,',
      'premium editorial portrait energy integrated into the environment,',
      'natural light, thoughtful presence, adult premium visual language,',
      'not a mascot, not a costume character, not cartoon.',
    ].join(' '),
    negativeAdditions: UNIVERSAL_STYLE_NEGATIVE,
  },
  curious_panda: {
    id: 'curious_panda',
    label: 'Meraklı Panda',
    shortLabel: 'Meraklı Panda',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'premium anthropomorphic curious panda,',
      'adult cinematic editorial character,',
      'naturally present inside the scene environment,',
      'curious but calm, refined travel mood,',
      'integrated into place and light like a film still,',
      'not a cute mascot, not a sticker, not a toy, not cartoon,',
      'not children book illustration.',
    ].join(' '),
    negativeAdditions: [
      UNIVERSAL_STYLE_NEGATIVE,
      'plastic toy panda, chibi panda, kawaii panda, startup mascot panda',
    ].join(', '),
  },
  cinematic_no_character: {
    id: 'cinematic_no_character',
    label: 'Karaktersiz Sinema',
    shortLabel: 'Sinematik Sahne',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'no central character subject,',
      'focus on place, light, objects, atmosphere, and memory,',
      'cinematic editorial still, human absence as emotional space,',
      'premium film frame composition.',
    ].join(' '),
    negativeAdditions: [
      UNIVERSAL_STYLE_NEGATIVE,
      'central character portrait, mascot hero, talking animal',
    ].join(', '),
  },
  explorer_fox: {
    id: 'explorer_fox',
    label: 'Kaşif Tilki',
    shortLabel: 'Kaşif Tilki',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'elegant explorer fox, refined cinematic anthropomorphic character,',
      'intelligent curiosity, premium editorial animal portrayal,',
      'naturally integrated into the scene,',
      'not a mascot, not cartoon, not children book fox.',
    ].join(' '),
    negativeAdditions: [
      UNIVERSAL_STYLE_NEGATIVE,
      'cartoon fox mascot, plush fox, chibi fox',
    ].join(', '),
  },
  wise_owl: {
    id: 'wise_owl',
    label: 'Bilge Baykuş',
    shortLabel: 'Bilge Baykuş',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'wise owl figure, thoughtful research and decision mood,',
      'premium editorial anthropomorphic portrayal,',
      'calm strategic atmosphere, scene-integrated,',
      'not a cartoon mascot owl, not toy bird, not children book owl.',
    ].join(' '),
    negativeAdditions: [
      UNIVERSAL_STYLE_NEGATIVE,
      'comic owl mascot, toy owl, cheap mascot bird',
    ].join(', '),
  },
  vintage_editorial: {
    id: 'vintage_editorial',
    label: 'Vintage Dergi',
    shortLabel: 'Vintage',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'analog travel magazine editorial mood, retro film grain,',
      'warm faded color science, premium print photography feel,',
      'no text, no poster typography, no logo, no magazine layout UI.',
    ].join(' '),
    negativeAdditions: [UNIVERSAL_STYLE_NEGATIVE, 'readable text, poster layout, magazine cover mockup'].join(
      ', '
    ),
  },
  watercolor_editorial: {
    id: 'watercolor_editorial',
    label: 'Suluboya',
    shortLabel: 'Suluboya',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'premium watercolor editorial illustration,',
      'soft controlled washes, refined adult art direction,',
      'not children book, not cute cartoon, not naive drawing.',
    ].join(' '),
    negativeAdditions: [
      UNIVERSAL_STYLE_NEGATIVE,
      'children book watercolor, crayon doodle, naive kids art',
    ].join(', '),
  },
  minimal_poetic: {
    id: 'minimal_poetic',
    label: 'Minimal Şiir',
    shortLabel: 'Minimal',
    plusOnly: true,
    promptBlock: [
      'style lens:',
      'quiet minimal poetic scene, strong negative space,',
      'one or two symbolic objects, restrained palette,',
      'premium editorial calm, meditative composition.',
    ].join(' '),
    negativeAdditions: UNIVERSAL_STYLE_NEGATIVE,
  },
};

export function getStyleLens(id: StyleLensId): StyleLens {
  return STYLE_LENS_REGISTRY[id];
}

export function getNextStyleLensId(current: StyleLensId): StyleLensId {
  const order = STYLE_LENS_PLUS_CYCLE;
  const idx = order.indexOf(current);
  const next = idx < 0 ? 0 : (idx + 1) % order.length;
  return order[next]!;
}
