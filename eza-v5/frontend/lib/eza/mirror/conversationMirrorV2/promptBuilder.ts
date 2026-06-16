/**
 * Mirror V2 — cinematic poster prompt builder (Method A: AI full poster).
 * SAINA selects topic + copy; OpenAI only renders the poster from this contract.
 */

import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import {
  countWords,
  MIRROR_CLOSING_MAX_WORDS,
  MIRROR_TEXT_MAX_WORDS,
  MIRROR_TITLE_MAX_WORDS,
  toEmotionalAtmosphere,
} from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';

const BRAND_SAFE_ZONE_RULES = `Brand rules:
- Do not place any logo.
- Do not generate the SAINA logo.
- Leave clean empty space at the top-left for the SAINA logo.
- Leave clean empty space at the top-right for the date.
- Do not generate any date.
- Do not generate fake dates.
- No watermark.
- No fake UI chrome.`;

const CINEMATIC_POSTER_STRUCTURE = `Poster structure (mandatory):
- Top: empty safe zones only (logo left, date right — added by system, not by you).
- Hero: short cinematic title (2–5 words) + mirror text (reflective paragraph, max ${MIRROR_TEXT_MAX_WORDS} words).
- Scene: 80–90% of the frame — premium cinematic photography carries the emotional meaning.
- Bottom: optional ONE poetic closing line (max ${MIRROR_CLOSING_MAX_WORDS} words) OR nothing.
- No other text blocks. No columns. No cards. No footer analysis.`;

const FORBIDDEN_CONTENT = `Strictly forbidden on the poster image:
- "Bugün Görünen Desen" or any pattern/analysis section.
- "Yarın İçin İpucu" or any tip/advice/coaching section.
- Two-column dashboard footer, insight cards, metrics, scores, charts.
- Behavioral analysis, personality labels, self-improvement recommendations.
- Instructional language (imperatives, homework, coaching).
- Bullet lists, checklists, infographic layout, report layout.
- Productivity report or AI analytics card aesthetic.
- Self-help app or coach dashboard look.`;

const SAINA_IDENTITY_BLOCK = `SAINA identity:
- A cinematic visual reflection of a conversation — not a report.
- Quiet, reflective, premium, editorial.
- Feels like an A24 movie poster, luxury magazine cover, or visual poem.
- High sharing value; wow through atmosphere, not information density.`;

const VISUAL_METAPHOR_RULES = `Visual metaphor rules (critical):
- Communicate the EMOTIONAL meaning of the conversation — not literal keywords.
- Use atmosphere: light, distance, texture, silence, horizon, interior glow, human silhouette from behind.
- Do NOT illustrate topic keywords literally when a metaphor works better.

Examples:
- Japan travel → wonder, discovery, distance, curiosity (NOT Fuji, pagoda, kimono tourism clichés).
- Architecture → memory, permanence, craft, belonging (NOT generic glass villa stock render).
- AI / technology → human reflection, curiosity, unseen connections (NOT robot, hologram, blue tech UI).
- Personal care → quiet morning ritual, calm balance (NOT product ad hero shot).`;

const COMPOSITION_BLOCK = `Composition:
- 80–90% cinematic scene photography.
- 10–20% integrated editorial typography.
- Strong negative space.
- One central emotional idea.
- Low text density — total visible words under 45.`;

const TYPOGRAPHY_BLOCK = `Typography:
- Elegant editorial serif or refined sans for title.
- Mirror text: calm, reflective, smaller than title.
- Text integrated into the poster like a film poster — not pasted UI labels.`;

const DENTAL_PERSONAL_CARE_SCENE = `Personal-care scene direction:
A calm premium bathroom counter at morning light.
Soft ivory and warm gold tones.
Subtle water reflections.
Quiet decision-making atmosphere.
No medical claims, no before-after, no mouth close-up, no product-ad hero composition.`;

const AVOID_BLOCK = `Avoid:
- Generic AI art, cyberpunk clichés, neon overload, mascot style.
- Motivational poster clichés, social media template, infographic look.
- Literal landmark tourism, stock travel poster tropes.
- Robot faces, holographic brains, dashboard UI on glass.
- UI buttons, QR codes, watermarks, multiple content cards.`;

export function isDentalPersonalCarePayload(payload: SainaMirrorPayload): boolean {
  const blob = [
    payload.selectedTopic,
    payload.topicSummary,
    payload.sceneMetaphor,
    payload.topic,
    ...payload.visualKeywords,
    ...payload.candidateTopics.map((c) => c.topic),
  ]
    .join(' ')
    .toLowerCase();
  return /diş|toothpaste|dental|florür|beyazlat|hassas|hygiene|macun/.test(blob);
}

export function buildMirrorV2ImagePrompt(payload: SainaMirrorPayload): string {
  const season = getSeasonProfile(payload.season);
  const atmosphere = toEmotionalAtmosphere(payload.visualKeywords);
  const emotionalAtmosphere =
    atmosphere.length > 0
      ? atmosphere.join(', ')
      : 'quiet atmosphere, emotional depth, cinematic light';
  const dentalCare = isDentalPersonalCarePayload(payload);

  const closing = payload.closingLine?.trim()
    ? `Optional closing line (max ${MIRROR_CLOSING_MAX_WORDS} words, poetic only — no advice): "${payload.closingLine}"`
    : 'No closing line — scene may end without footer text.';

  const blocks = [
    'Create a premium cinematic SAINA Conversation Mirror poster.',
    '',
    'Format: Vertical 4:5 poster, 1080x1350.',
    '',
    BRAND_SAFE_ZONE_RULES,
    '',
    CINEMATIC_POSTER_STRUCTURE,
    '',
    FORBIDDEN_CONTENT,
    '',
    SAINA_IDENTITY_BLOCK,
    '',
    VISUAL_METAPHOR_RULES,
    '',
    'Season art direction:',
    `${season.labelTr}. ${season.palette} ${season.visualLanguage}`,
    '',
    'Conversation scope: This poster reflects only the active conversation thread.',
    '',
    `Title (embed exactly, ${MIRROR_TITLE_MAX_WORDS} words max): "${payload.mirrorTitle}"`,
    '',
    `Mirror text (embed exactly, reflective tone, no advice — ${countWords(payload.mirrorText)} words):`,
    `"${payload.mirrorText}"`,
    '',
    closing,
    '',
    'Scene direction (metaphor — interpret atmospherically, do not literalize):',
    `${payload.sceneMetaphor}.`,
    '',
    'Emotional atmosphere (light, mood, feeling — do NOT spell out as labels in the image):',
    `${emotionalAtmosphere}. Tone: ${payload.emotionalTone}.`,
  ];

  if (dentalCare) {
    blocks.push('', DENTAL_PERSONAL_CARE_SCENE);
  }

  blocks.push('', TYPOGRAPHY_BLOCK, '', COMPOSITION_BLOCK, '', AVOID_BLOCK);

  return blocks.filter((line) => line !== '').join('\n');
}

export const MIRROR_V2_NEGATIVE_PROMPT = [
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
  'instructional text',
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
  'lorem ipsum',
  'misspelled text',
  'garbled typography',
  'before-after teeth',
  'dental procedure',
  'whitening transformation',
  'diseased teeth',
  'mouth close-up',
  'checklist layout',
  'instruction sheet',
  'product advertisement',
  'commercial hero product',
  'packshot',
  'bugün görünen desen',
  'yarın için ipucu',
].join(', ');
