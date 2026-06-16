/**
 * Mirror V3 — OpenAI prompt contract (full poster typography by AI).
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

const BRAND_SAFE_ZONE_RULES = `Brand safe zones (system adds these — you must NOT render them):
- Top-left: empty for SAINA logo.
- Top-right: empty for date.
- Bottom-center: empty band for small brand signature (two lines).
- Do not place any logo, date, or footer signature.
- No watermark. No fake UI chrome.`;

const V3_TYPOGRAPHY_RULES = `Typography (mandatory — you compose ALL poster text):
- Render title, mirror copy, and optional closing line inside the image.
- You decide title size, placement, body placement, and hierarchy.
- Elegant editorial serif or refined sans for title.
- Mirror text: calm, reflective, smaller than title.
- Text integrated like an A24 film poster — never pasted UI labels.
- SAINA supplies copy only; you own composition.`;

const VISUAL_WEIGHT = `Visual weight:
- 80–90% cinematic scene photography.
- 10–20% integrated editorial typography.
- User should feel first, then read — never read first.`;

const NARRATIVE_LAYER_RULES = `Narrative layer (critical):
- Transform topic into meaning → emotion → story — never literal illustration.
- Japan travel → wonder, distance, discovery (NOT Fuji, pagoda, tourism checklist).
- Architecture → memory, permanence, craft (NOT stock villa render).
- AI → human reflection about intelligence (NOT robot, hologram).
- Personal care → trust, quiet ritual (NOT product advertisement).
- Religion → silence, meaning, inner direction (NOT preaching).`;

const NARRATIVE_DISTANCE_RULES = `Narrative distance (V3.1 — target level 2–3):
- The poster is a cinematic interpretation of a conversation — NOT a summary.
- Mirror copy describes meaning and feeling — never what was discussed.
- Forbidden in mirror copy: "today you discussed", "you talked about", "bugün … konuştun", "bugün … araştırdın", "konuşman", "sohbetin".
- A stranger should find the poster beautiful; the participant should recognize themselves through emotion alone.
- Selected topic is for internal art direction only — do not name it in the poster text.`;

const FORBIDDEN_BLOCK = `Strictly forbidden on the poster:
- ${FORBIDDEN_MIRROR_PHRASES.join(', ')}.
- Conversation summary language (today you discussed, you talked about, bugün konuştun, bugün araştırdın).
- Naming the conversation subject literally in mirror copy.
- Animal archetypes, personality types, character engine concepts.
- Metrics, scores, progress bars, charts, analytics cards, dashboard UI.
- Coaching language, self-help language, tips, advice, homework.
- Two-column footer, insight widgets, pattern cards, report layout.
- Concepts: ${FORBIDDEN_MIRROR_CONCEPTS.slice(0, 12).join(', ')}.`;

const VISUAL_DIVERSITY = `Visual diversity:
- Vary composition, typography placement, cinematic framing, and storytelling each time.
- Preserve SAINA identity: quiet, reflective, premium, editorial.
- Never repeat the same layout template across generations.`;

export function buildMirrorV3ImagePrompt(payload: SainaMirrorV3Payload): string {
  const season = getSeasonProfile(payload.season);
  const dentalCare = isDentalPersonalCarePayload(payload);

  const closing = payload.closingLine?.trim()
    ? `Optional closing line (max ${MIRROR_CLOSING_MAX_WORDS} words, poetic only — no advice): "${payload.closingLine}"`
    : 'No closing line — scene may end without footer text.';

  const blocks = [
    'Create a premium SAINA Conversation Mirror poster — a cinematic reflection of a conversation, not a report.',
    '',
    'Format: Vertical 4:5 poster, 1080x1350.',
    '',
    BRAND_SAFE_ZONE_RULES,
    '',
    V3_TYPOGRAPHY_RULES,
    '',
    VISUAL_WEIGHT,
    '',
    FORBIDDEN_BLOCK,
    '',
    NARRATIVE_LAYER_RULES,
    '',
    NARRATIVE_DISTANCE_RULES,
    '',
    'OpenAI prompt contract — required fields:',
    `Selected topic (art direction only — do NOT echo in poster text): "${payload.selectedTopic}"`,
    `Mirror title (embed exactly, ${MIRROR_TITLE_MAX_WORDS} words max): "${payload.mirrorTitle}"`,
    `Mirror copy (embed exactly — meaning only, no conversation recap — ${countWords(payload.mirrorText)} words, max ${MIRROR_TEXT_MAX_WORDS}):`,
    `"${payload.mirrorText}"`,
    `Narrative theme: ${payload.narrativeTheme}`,
    `Meaning: ${payload.meaning}`,
    `Emotion: ${payload.emotion}`,
    `Narrative distance: level ${payload.narrativeDistance} — ${payload.narrativeDistanceLabel}`,
    `Scene metaphor (interpret atmospherically, do not literalize): ${payload.sceneMetaphor}`,
    `Emotional atmosphere: ${payload.emotionalAtmosphere}. Tone: ${payload.emotionalTone}.`,
    '',
    closing,
    '',
    'Season art direction:',
    `${season.labelTr}. ${season.palette} ${season.visualLanguage}`,
    '',
    VISUAL_DIVERSITY,
  ];

  if (dentalCare) {
    blocks.push(
      '',
      'Personal-care scene: calm premium morning light, ivory and warm gold, subtle water reflections, quiet decision-making. No product ad, no mouth close-up.'
    );
  }

  blocks.push(
    '',
    'Avoid: generic AI art, cyberpunk clichés, neon overload, motivational poster, infographic, stock travel tropes, robot faces, dashboard UI on glass.'
  );

  return blocks.filter((line) => line !== '').join('\n');
}

export const MIRROR_V3_NEGATIVE_PROMPT = [
  'logo',
  'brand mark',
  'watermark',
  'qr code',
  'dashboard',
  'chart',
  'graph',
  'progress bar',
  'score',
  'percentage',
  'infographic',
  'coaching card',
  'self-help',
  'personality analysis',
  'tip card',
  'pattern card',
  'two column footer',
  'analysis block',
  'panda',
  'fox',
  'deer',
  'owl',
  'turtle',
  'archetype',
  'character engine',
  'analytics card',
  'insight widget',
  'motivational poster',
  'neon cyberpunk',
  'robot face',
  'hologram brain',
  'ai dashboard',
  'mount fuji',
  'pagoda',
  'kimono tourist',
  'stock photo template',
  'busy UI',
  'fake date stamp',
  'product advertisement',
  'commercial hero product',
  'bugün görünen desen',
  'yarın için ipucu',
  'ilişki ritmi',
  'enerjin',
  'gelişim',
  'keşif score',
  'today you discussed',
  'you talked about',
  'bugün konuştun',
  'bugün araştırdın',
  'conversation summary',
].join(', ');
