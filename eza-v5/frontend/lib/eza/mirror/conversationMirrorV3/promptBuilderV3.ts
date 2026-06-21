/**
 * Mirror V4.5 — evidence fusion + world layer art direction.
 * Pipeline: Topic → Evidence Fusion → World Layer → Poster.
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import {
  countWords,
  MIRROR_TITLE_MAX_WORDS,
} from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import {
  FORBIDDEN_MIRROR_CONCEPTS,
  FORBIDDEN_MIRROR_PHRASES,
} from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';
import { isDentalPersonalCarePayload } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { formatEvidenceFusionBlock } from '@/lib/eza/mirror/conversationMirrorV3/evidenceFusionV44';
import { resolveTopicShotMode } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';

const POSTER_TASK = `Create a premium cinematic SAINA Conversation Mirror poster, vertical 4:5, 1080x1350.
This is a conversation poster — NOT an emotion poster, NOT a summary card, NOT coaching UI.
The user shares what they explored with AI today. The topic itself is the story.`;

const CRITICAL_RULE = `Critical rule:
Do not transform the topic into a metaphor.
Do not replace the topic with emotion, atmosphere, or philosophy.
Render one unified, recognizable hero scene — never an object catalog or moodboard.`;

const POSTER_TEST = `Poster test:
What was this person talking about?
If the answer is obvious within 3 seconds — PASS.
If the answer is "not sure" — FAIL.`;

const VISUAL_WEIGHT = `Visual weight:
Evidence fusion scene: 70%
Typography: 10%
Everything else: 0% — meaning and emotion must NOT influence the image.`;

const FORBIDDEN_VISUALS = `Forbidden visuals:
- generic silhouette, person facing horizon, foggy wanderer
- abstract path, generic mountain, inner journey
- symbolic discovery, emotional landscape, universal wonder
- cinematic possibility, distance-and-curiosity scene
- picture-in-picture inset, collage, diptych, split frame
- lonely figure in fog, walking away from camera as hero subject`;

const VISUAL_STYLE = `Visual style:
Premium editorial photograph — NOT illustration, NOT 3D render, NOT stock template.
Documentary authenticity. One hero anchor. Vertical 4:5. 35–45% negative space for type.
Recognizable conversation traces visible in the scene — not abstract interpretation.`;

const TYPOGRAPHY_RULES = `Typography (10%):
Title: 100 — embed exactly as given, 2–5 words preferred, max ${MIRROR_TITLE_MAX_WORDS} words, max 2 lines.
Body: 25 — embed exactly as given, max 2 lines, 20–45 words.
Maximum 2 text zones: one title, one body. No closing line, footer quote, badges, or panels.
OpenAI owns placement and scale. System adds logo (top-left), date (top-right), signature (bottom) — do NOT render these.`;

const BRAND_SAFE_ZONE_RULES = `Brand safe zones (system overlay only — do NOT render):
Top-left: SAINA logo. Top-right: date. Bottom-center: signature band.`;

const FORBIDDEN_CONCEPTS_BLOCK = `Forbidden text/UI:
- ${FORBIDDEN_MIRROR_PHRASES.slice(0, 8).join(', ')}.
- Dashboard, metrics, scores, coaching, insight cards, widgets.
- Concepts: ${FORBIDDEN_MIRROR_CONCEPTS.slice(0, 10).join(', ')}.`;

const SCENE_AVOID = `Scene avoid:
tourism brochure, postcard, stock tourist, product ad, robot, neon brain, dashboard UI, checklist layout, generic fog silhouette, interchangeable emotional landscape.`;

export function buildMirrorV3ImagePrompt(payload: SainaMirrorV3Payload): string {
  const season = getSeasonProfile(payload.season);
  const dentalCare = isDentalPersonalCarePayload(payload);
  const shot = resolveTopicShotMode({
    storyTopicId: payload.storyTopicId,
    evidence: payload.conversationEvidence ?? [],
    selectedTopic: payload.selectedTopic,
  });
  const fusionBlock = formatEvidenceFusionBlock({
    heroScene: payload.sceneComposition?.heroScene ?? payload.sceneMetaphor,
    evidenceFusionScene:
      payload.sceneComposition?.evidenceFusionScene ?? payload.sceneMetaphor,
    worldLayer: payload.sceneComposition?.worldLayer ?? '',
  });

  const blocks = [
    POSTER_TASK,
    '',
    `Topic: "${payload.selectedTopic}"`,
    '',
    fusionBlock,
    CRITICAL_RULE,
    FORBIDDEN_VISUALS,
    POSTER_TEST,
    VISUAL_WEIGHT,
    '',
    `Mirror title (embed exactly): "${payload.mirrorTitle}"`,
    `Mirror copy (embed exactly — ${countWords(payload.mirrorText)} words): "${payload.mirrorText}"`,
    '',
    VISUAL_STYLE,
    `Shot: ${shot.mode} — ${shot.description}`,
    `Lighting: ${season.lightingRecipe}`,
    '',
    TYPOGRAPHY_RULES,
    BRAND_SAFE_ZONE_RULES,
    FORBIDDEN_CONCEPTS_BLOCK,
    SCENE_AVOID,
  ];

  if (dentalCare) {
    blocks.push(
      '',
      'Topic scene: calm bathroom counter, two products, morning light. No clinical close-up, no product ad.'
    );
  }

  return blocks.filter((line) => line !== '').join('\n');
}

/** Art-direction failures first — backend truncates negative append to ~600 chars. */
export const MIRROR_V3_NEGATIVE_PROMPT = [
  'stock photo smiling tourist',
  'person facing horizon',
  'person walking away',
  'lonely silhouette',
  'foggy wanderer',
  'generic silhouette',
  'abstract path',
  'generic mountain',
  'inner journey',
  'symbolic discovery',
  'emotional landscape',
  'universal wonder',
  'cinematic possibility',
  'distance and curiosity',
  'golden horizon silhouette',
  'oversaturated HDR',
  'fake lens flare',
  '3D render',
  'CGI villa',
  'tourism brochure',
  'motivational poster',
  'dashboard',
  'coaching card',
  'picture in picture',
  'inset photo',
  'collage',
  'diptych',
  'postcard layout',
  'robot face',
  'neon cyberpunk',
  'conversation summary',
  'bugün konuştun',
  'logo',
  'watermark',
].join(', ');
