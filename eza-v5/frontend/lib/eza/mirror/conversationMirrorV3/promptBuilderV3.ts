/**
 * Mirror V3.2 — OpenAI prompt contract (director's shot list + editorial poster).
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import {
  countWords,
  MIRROR_CLOSING_MAX_WORDS,
  MIRROR_TEXT_MAX_WORDS,
  MIRROR_TITLE_MAX_WORDS,
} from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import {
  FORBIDDEN_MIRROR_CONCEPTS,
  FORBIDDEN_MIRROR_PHRASES,
} from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';
import { isDentalPersonalCarePayload } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import {
  ART_DIRECTION_AVOID_BLOCK,
  CINEMATOGRAPHY_CONTRACT,
  getReferenceTierBlock,
  resolveReferenceTier,
  resolveShotMode,
  TYPOGRAPHY_GRID_CONTRACT,
  VISUAL_METAPHOR_TRANSLATION,
} from '@/lib/eza/mirror/conversationMirrorV3/artDirectionV32';
import { getNarrativeDistanceVisualGuidance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { buildMirrorV3SeedHint } from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';

const VISUAL_WEIGHT = `Visual weight:
- 80–90% cinematic scene photography.
- 10–20% integrated editorial typography.
- User should feel first, then read — never read first.`;

const BRAND_SAFE_ZONE_RULES = `Brand safe zones (system adds these — you must NOT render them):
- Top-left: empty for SAINA logo.
- Top-right: empty for date.
- Bottom-center: empty band for small brand signature (two lines).
- Do not place any logo, date, or footer signature.
- No watermark. No fake UI chrome.`;

const NARRATIVE_COPY_RULES = `Narrative copy rules:
- This is a cinematic interpretation of a conversation — NOT a summary.
- Mirror copy describes meaning and feeling — never what was discussed.
- Forbidden in mirror copy: "today you discussed", "you talked about", "bugün … konuştun", "bugün … araştırdın".
- Selected topic is for internal art direction only — do not name it in the poster text.
- A stranger should find the poster beautiful; the participant should recognize themselves through emotion alone.`;

const FORBIDDEN_CONCEPTS_BLOCK = `Strictly forbidden concepts:
- ${FORBIDDEN_MIRROR_PHRASES.join(', ')}.
- Animal archetypes, personality types, character engine concepts.
- Metrics, scores, progress bars, charts, analytics cards, dashboard UI.
- Coaching language, self-help language, tips, advice, homework.
- Concepts: ${FORBIDDEN_MIRROR_CONCEPTS.slice(0, 12).join(', ')}.`;

const HUMAN_READABLE_STYLE = `Style: premium editorial photograph — NOT illustration, NOT 3D render, NOT CGI villa, NOT stock photo template.
Documentary authenticity, not fantasy illustration.`;

export function buildMirrorV3ImagePrompt(payload: SainaMirrorV3Payload): string {
  const season = getSeasonProfile(payload.season);
  const dentalCare = isDentalPersonalCarePayload(payload);
  const seedKey = buildMirrorV3SeedHint(payload);
  const shot = resolveShotMode(seedKey);
  const referenceTier = resolveReferenceTier(seedKey, payload.season);

  const closing = payload.closingLine?.trim()
    ? `Optional closing line (max ${MIRROR_CLOSING_MAX_WORDS} words, poetic only — no advice): "${payload.closingLine}"`
    : 'No closing line — scene may end without footer text.';

  const blocks = [
    // 1. Poster task
    'Create a premium cinematic SAINA Conversation Mirror poster, vertical 4:5, 1080x1350.',
    'This is not a summary card. This is a cinematic interpretation of a conversation\'s meaning.',
    '',
    // 2. Conversation meaning payload
    `Mirror title (embed exactly, ${MIRROR_TITLE_MAX_WORDS} words max): "${payload.mirrorTitle}"`,
    `Mirror copy (embed exactly — meaning only, no conversation recap — ${countWords(payload.mirrorText)} words, max ${MIRROR_TEXT_MAX_WORDS}):`,
    `"${payload.mirrorText}"`,
    closing,
    '',
    `Selected topic (art direction only — do NOT echo in poster text): "${payload.selectedTopic}"`,
    `Narrative theme: ${payload.narrativeTheme}`,
    `Meaning: ${payload.meaning}`,
    `Emotion: ${payload.emotion}`,
    `Narrative distance: level ${payload.narrativeDistance} — ${payload.narrativeDistanceLabel}`,
    `Scene metaphor (interpret atmospherically, do not literalize): ${payload.sceneMetaphor}`,
    `Emotional atmosphere: ${payload.emotionalAtmosphere}. Tone: ${payload.emotionalTone}.`,
    '',
    // 3. Art direction
    'Season art direction:',
    `${season.labelTr}. Mood: ${season.mood}. Palette: ${season.palette}.`,
    `${season.visualLanguage}`,
    '',
    'Lighting recipe:',
    season.lightingRecipe,
    '',
    `Shot mode (${shot.mode}):`,
    shot.description,
    '',
    getReferenceTierBlock(referenceTier),
    '',
    HUMAN_READABLE_STYLE,
    '',
    VISUAL_WEIGHT,
    '',
    // 4. Cinematography contract
    CINEMATOGRAPHY_CONTRACT,
    '',
    // 5. Typography grid
    TYPOGRAPHY_GRID_CONTRACT,
    '',
    // 6. Narrative distance visual behavior
    getNarrativeDistanceVisualGuidance(payload.narrativeDistance),
    '',
    NARRATIVE_COPY_RULES,
    '',
    // 7. Visual metaphor translation
    VISUAL_METAPHOR_TRANSLATION,
    '',
    // 8. Brand safe zones
    BRAND_SAFE_ZONE_RULES,
    '',
    // 9. Negative list + forbidden concepts
    ART_DIRECTION_AVOID_BLOCK,
    '',
    FORBIDDEN_CONCEPTS_BLOCK,
  ];

  if (dentalCare) {
    blocks.push(
      '',
      'Personal-care scene: calm premium morning light, ivory and warm gold, subtle water reflections, quiet decision-making. No product ad, no mouth close-up.'
    );
  }

  return blocks.filter((line) => line !== '').join('\n');
}

/** Art-direction failures first — backend truncates negative append to ~600 chars. */
export const MIRROR_V3_NEGATIVE_PROMPT = [
  'stock photo smiling tourist',
  'centered motivational quote layout',
  'oversaturated HDR',
  'fake lens flare',
  'AI gloss',
  'plastic skin',
  '3D architectural render',
  'CGI villa',
  'Pinterest filter pack',
  'generic drone landscape',
  'symmetrical pagoda',
  'temple checklist',
  'mount fuji postcard',
  'kimono tourist',
  'robot face',
  'neon circuit brain',
  'tourism brochure',
  'product advertisement',
  'commercial hero product',
  'motivational poster',
  'generic AI art',
  'stock photo template',
  'dashboard',
  'chart',
  'graph',
  'progress bar',
  'score',
  'infographic',
  'coaching card',
  'self-help',
  'UI card template',
  'checklist layout',
  'logo',
  'watermark',
  'neon cyberpunk',
  'hologram brain',
  'ai dashboard',
  'busy UI',
  'fake date stamp',
  'bugün görünen desen',
  'yarın için ipucu',
  'today you discussed',
  'bugün konuştun',
  'conversation summary',
  'panda',
  'fox',
  'deer',
  'archetype',
].join(', ');
