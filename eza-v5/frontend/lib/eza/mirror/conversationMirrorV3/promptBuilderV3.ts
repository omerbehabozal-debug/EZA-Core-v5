/**
 * Mirror V3.3 — OpenAI prompt contract (conversation evidence + premium poster).
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
} from '@/lib/eza/mirror/conversationMirrorV3/artDirectionV32';
import {
  ABSTRACTION_LIMIT,
  EVIDENCE_SCENE_AVOID,
  OPENAI_POSTER_TEXT_CONTRACT,
  SCENE_CLARITY_RULE,
  TOPIC_VISIBILITY_RULE,
  TYPOGRAPHY_DIRECTOR_CONTRACT,
  VISUAL_METAPHOR_TRANSLATION_V33,
} from '@/lib/eza/mirror/conversationMirrorV3/artDirectionV33';
import { formatConversationEvidenceBlock } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import { getNarrativeDistanceVisualGuidance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { buildMirrorV3SeedHint } from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';

const HUMAN_READABLE_STYLE = `Style: premium editorial photograph — NOT illustration, NOT 3D render, NOT CGI villa, NOT stock photo template.
Documentary authenticity with recognizable conversation traces, not fantasy illustration.`;

const NARRATIVE_MEANING_BLOCK = `Meaning layer (25% — mood, not topic erasure):
- Mirror copy describes why the topic mattered emotionally — never a conversation recap.
- Forbidden in mirror copy: "today you discussed", "you talked about", "bugün … konuştun", "bugün … araştırdın".
- Selected topic and evidence guide the scene — do not name them verbatim in poster text unless already in mirror title/copy.
- A stranger should infer the topic from scene evidence within 3 seconds; the participant should feel ownership through recognizable traces.`;

const FORBIDDEN_CONCEPTS_BLOCK = `Strictly forbidden concepts:
- ${FORBIDDEN_MIRROR_PHRASES.join(', ')}.
- Animal archetypes, personality types, character engine concepts.
- Metrics, scores, progress bars, charts, analytics cards, dashboard UI.
- Coaching language, self-help language, tips, advice, homework.
- Concepts: ${FORBIDDEN_MIRROR_CONCEPTS.slice(0, 12).join(', ')}.`;

const BRAND_SAFE_ZONE_RULES = `Brand safe zones (system adds these — you must NOT render them):
- Top-left: empty for SAINA logo.
- Top-right: empty for date.
- Bottom-center: empty band for small brand signature (two lines).
- Do not place any logo, date, or footer signature.
- No watermark. No fake UI chrome.`;

export function buildMirrorV3ImagePrompt(payload: SainaMirrorV3Payload): string {
  const season = getSeasonProfile(payload.season);
  const dentalCare = isDentalPersonalCarePayload(payload);
  const seedKey = buildMirrorV3SeedHint(payload);
  const shot = resolveShotMode(seedKey);
  const referenceTier = resolveReferenceTier(seedKey, payload.season);
  const evidenceBlock = formatConversationEvidenceBlock(payload.conversationEvidence ?? []);

  const closing = payload.closingLine?.trim()
    ? `Optional closing line (max ${MIRROR_CLOSING_MAX_WORDS} words, poetic only — no advice): "${payload.closingLine}"`
    : 'No closing line — scene may end without footer text.';

  const blocks = [
    // 1. Poster task
    'Create a premium cinematic SAINA Conversation Mirror poster, vertical 4:5, 1080x1350.',
    'Transform the active conversation topic into a cinematic, premium, shareable poster.',
    'This is not a summary card, dashboard, or coaching UI.',
    '',
    // 2. Selected topic
    `Selected topic (scene direction — do NOT recap as bullet text): "${payload.selectedTopic}"`,
    `Primary story topic: ${payload.topic}`,
    '',
    // 3. Conversation evidence
    evidenceBlock,
    '',
    // 4. Topic visibility rule
    TOPIC_VISIBILITY_RULE,
    ABSTRACTION_LIMIT,
    '',
    // 5–6. Mirror title + copy
    `Mirror title (embed exactly, ${MIRROR_TITLE_MAX_WORDS} words max): "${payload.mirrorTitle}"`,
    `Mirror copy (embed exactly — meaning layer, no conversation recap — ${countWords(payload.mirrorText)} words, max ${MIRROR_TEXT_MAX_WORDS}):`,
    `"${payload.mirrorText}"`,
    closing,
    '',
    // 7. Meaning / emotion
    NARRATIVE_MEANING_BLOCK,
    `Narrative theme: ${payload.narrativeTheme}`,
    `Meaning: ${payload.meaning}`,
    `Emotion: ${payload.emotion}`,
    `Narrative distance: level ${payload.narrativeDistance} — ${payload.narrativeDistanceLabel}`,
    `Scene metaphor (support evidence — do not replace concrete traces): ${payload.sceneMetaphor}`,
    `Emotional atmosphere: ${payload.emotionalAtmosphere}. Tone: ${payload.emotionalTone}.`,
    getNarrativeDistanceVisualGuidance(payload.narrativeDistance),
    '',
    // 8. Cinematography contract
    CINEMATOGRAPHY_CONTRACT,
    SCENE_CLARITY_RULE,
    '',
    `Shot mode (${shot.mode}):`,
    shot.description,
    '',
    getReferenceTierBlock(referenceTier),
    HUMAN_READABLE_STYLE,
    '',
    // 9. Typography director
    TYPOGRAPHY_DIRECTOR_CONTRACT,
    TYPOGRAPHY_GRID_CONTRACT,
    OPENAI_POSTER_TEXT_CONTRACT,
    '',
    // 10. Season lighting
    'Season art direction:',
    `${season.labelTr}. Mood: ${season.mood}. Palette: ${season.palette}.`,
    `${season.visualLanguage}`,
    '',
    'Lighting recipe:',
    season.lightingRecipe,
    '',
    // 11. Visual metaphor rules
    VISUAL_METAPHOR_TRANSLATION_V33,
    '',
    // 12. Brand safe zones
    BRAND_SAFE_ZONE_RULES,
    '',
    // 13. Negative list
    ART_DIRECTION_AVOID_BLOCK,
    EVIDENCE_SCENE_AVOID,
    FORBIDDEN_CONCEPTS_BLOCK,
  ];

  if (dentalCare) {
    blocks.push(
      '',
      'Personal-care scene: calm premium morning light, ivory and warm gold, bathroom counter ritual, quiet decision between products. No product ad, no mouth close-up, no clinical treatment.'
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
  'insight block',
  'postcard layout',
  'showroom commercial',
].join(', ');
