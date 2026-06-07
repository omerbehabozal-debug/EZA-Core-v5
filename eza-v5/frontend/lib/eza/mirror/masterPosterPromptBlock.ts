/**
 * Master poster OpenAI prompt block — exact EZA headline/quote + scene keywords.
 */

import type { MasterPosterText } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';

export const MASTER_POSTER_TEXT_RULES = [
  'Create a premium vertical editorial poster scene.',
  'Place the headline and quote naturally inside the cinematic composition with strong readability.',
  'Do not add any other readable text.',
  'Do not add logos.',
  'Do not add dates.',
  'Do not add usernames.',
  'Do not add phone numbers.',
  'Do not add addresses.',
  'Do not invent extra captions.',
  'Do not translate the provided headline or quote.',
  'Use the headline and quote exactly as provided.',
] as const;

export function buildMasterPosterPromptBlock(input: {
  masterPosterText: MasterPosterText;
  sceneSubtopic?: SceneSubtopicResolution;
}): string {
  const keywords = input.sceneSubtopic?.sceneKeywords ?? [];
  const keywordBlock =
    keywords.length > 0
      ? `SCENE KEYWORDS:\n${keywords.map((k) => `- ${k}`).join('\n')}`
      : '';

  const textBlock = [
    'VISIBLE POSTER TEXT:',
    `Headline: ${input.masterPosterText.headline}`,
    `Quote: ${input.masterPosterText.quote}`,
  ].join('\n');

  const instructionBlock = [
    MASTER_POSTER_TEXT_RULES[0],
    `The poster must include exactly this visible headline text:`,
    `"${input.masterPosterText.headline}"`,
    `The poster must include exactly this visible short quote:`,
    `"${input.masterPosterText.quote}"`,
    ...MASTER_POSTER_TEXT_RULES.slice(1),
  ].join(' ');

  return [instructionBlock, keywordBlock, textBlock].filter(Boolean).join('\n\n');
}
