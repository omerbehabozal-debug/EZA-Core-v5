/**
 * Hybrid poster middle-area prompt builder — Sprint 13C.
 * OpenAI generates editorial artwork with embedded Turkish copy in the middle zone.
 */

import type { VisualNarrativeDirection } from '@/lib/eza/mirror/visualNarrativeDirector';
import { buildCompositionContract } from '@/lib/eza/mirror/compositionContractBuilder';
import { buildHybridPosterNegativePrompt } from '@/lib/eza/mirror/mirrorPosterNegativePrompts';
import { getIntentLockForbiddenPhrases } from '@/lib/eza/mirror/intentLockSystem';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import { STYLE_BLOCK, LIGHTING_BLOCK } from '@/lib/eza/mirror/posterPromptBlocks';

export const HYBRID_HEADLINE_MAX = 28;
export const HYBRID_SUBHEADLINE_MAX = 18;
export const HYBRID_DESCRIPTION_MAX = 110;
export const HYBRID_THEME_TITLE_MAX = 24;
export const HYBRID_THEME_DESC_MAX = 90;
export const HYBRID_QUOTE_MAX = 90;

export type HybridPosterTextPayload = {
  headline: string;
  subheadline?: string;
  description: string;
  themeTitle: string;
  themeDescription: string;
  quote: string;
};

export type HybridPosterPromptInput = {
  narrative: VisualNarrativeDirection;
  headline: string;
  subheadline?: string;
  description: string;
  themeTitle: string;
  themeDescription: string;
  quote: string;
  sceneIntent: string;
  heroObjects: string[];
  colorMood: string;
  typographyStyle: string;
  lockedIntent?: LockedPrimaryIntentId;
};

export type HybridPosterPromptPayload = {
  prompt: string;
  negativePrompt: string;
  textPayload: HybridPosterTextPayload;
};

export function truncateHybridText(value: string, max: number): string {
  const t = value.trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function clampHybridInput(input: HybridPosterPromptInput): HybridPosterTextPayload {
  return {
    headline: truncateHybridText(input.headline, HYBRID_HEADLINE_MAX),
    subheadline: input.subheadline
      ? truncateHybridText(input.subheadline, HYBRID_SUBHEADLINE_MAX)
      : undefined,
    description: truncateHybridText(input.description, HYBRID_DESCRIPTION_MAX),
    themeTitle: truncateHybridText(input.themeTitle, HYBRID_THEME_TITLE_MAX),
    themeDescription: truncateHybridText(input.themeDescription, HYBRID_THEME_DESC_MAX),
    quote: truncateHybridText(input.quote, HYBRID_QUOTE_MAX),
  };
}

/**
 * Builds hybrid middle poster prompt — embedded Turkish copy in scene artwork.
 */
export function buildHybridPosterPrompt(
  input: HybridPosterPromptInput
): HybridPosterPromptPayload {
  const textPayload = clampHybridInput(input);
  const contract = buildCompositionContract(input.narrative);

  const textBlock = [
    `Headline (upper-left, exact Turkish): "${textPayload.headline}"`,
    textPayload.subheadline
      ? `Subheadline (script style below headline, exact): "${textPayload.subheadline}"`
      : '',
    `Short description (below subheadline, exact Turkish): "${textPayload.description}"`,
    `Theme card (soft translucent, center-left, exact Turkish title): "${textPayload.themeTitle}"`,
    `Theme card description (exact Turkish): "${textPayload.themeDescription}"`,
    `Quote (lower-middle, elegant editorial, exact Turkish): "${textPayload.quote}"`,
  ]
    .filter(Boolean)
    .join('. ');

  const promptParts = [
    'You are a professional editorial poster designer.',
    'Create the middle artwork zone of a premium EZA Mirror vertical poster.',
    'This image will merge with frontend-controlled top brand area and bottom insight cards.',
    '9:16 vertical poster composition, 1080 by 1920 feel.',
    'Leave top 10 percent empty and low-detail for frontend logo and date overlay.',
    'Leave bottom 25 percent open, soft, low-detail for frontend SEN AI DENGE insight cards.',
    'Main story lives in middle 65 percent with scene and integrated typography.',
    'Hero subject or character on right or center-right; hero objects visible in lower and mid scene.',
    'Left and upper-left clean areas for headline stack; scene and typography share warm cream and soft violet EZA palette.',
    'Cinematic depth with foreground midground background separation.',
    'Only use the provided Turkish text exactly — do not add any other readable text.',
    'Do not add EZA logo, date, SEN/AI/DENGE cards, footer, hashtag, website, buttons, or app UI.',
    `Scene intent: ${input.sceneIntent}.`,
    `Hero objects: ${input.heroObjects.join(', ')}.`,
    `Environment: ${contract.requiredEnvironment}.`,
    `Character blocking: ${contract.characterBlocking}.`,
    `Camera: ${contract.cameraDirection}.`,
    `Visual density: ${contract.visualDensityRule}.`,
    `Color mood: ${input.colorMood}.`,
    `Typography style: ${input.typographyStyle}.`,
    textBlock,
    `Style: ${STYLE_BLOCK}, ${LIGHTING_BLOCK}.`,
    'Premium editorial integrated poster artwork, not a flat UI card mockup.',
  ];

  const negativeExtras = [
    ...contract.forbiddenSceneTypes,
    ...getIntentLockForbiddenPhrases(input.lockedIntent ?? null),
  ];

  return {
    prompt: promptParts.join(' '),
    negativePrompt: buildHybridPosterNegativePrompt(negativeExtras),
    textPayload,
  };
}
