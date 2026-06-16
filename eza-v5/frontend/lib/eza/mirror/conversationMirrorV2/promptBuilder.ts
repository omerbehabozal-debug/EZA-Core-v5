/**

 * Mirror V2 — cinematic poster prompt builder (Method A: AI full poster).

 * SAINA selects topic + copy; OpenAI only renders the poster from this contract.

 */



import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';

import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';



const BRAND_SAFE_ZONE_RULES = `Brand rules:

- Do not place any logo.

- Do not generate the SAINA logo.

- Leave clean empty space at the top-left for the SAINA logo.

- Leave clean empty space at the top-right for the date.

- Do not generate any date.

- Do not generate fake dates.

- No watermark.

- No fake UI chrome.

- No dashboard widgets.

- No charts, scores, progress bars, percentages or metrics.

- No dashboard.

- No multiple content cards.

- No "today's topics" section.

- No bullet lists.

- Keep total visible text under 50 words.

- Low text density.

- Premium cinematic poster, not a report.
- Do not visually reproduce this instruction structure. The final poster must not look like a prompt, checklist, UI spec, or instruction sheet.`;



const SAINA_IDENTITY_BLOCK = `SAINA identity:

- Quiet, reflective, premium, cinematic.

- A personal conversation transformed into a visual mirror.

- The card should feel like a film poster of the user's curiosity.

- Minimal text.

- Strong atmosphere.

- High sharing value.`;



const COMPOSITION_BLOCK = `Composition:

- 70–85% cinematic scene.

- 15–30% text.

- Strong negative space.

- One central emotional idea.

- Highly shareable.

- Wow effect without looking like an advertisement.`;



const TYPOGRAPHY_BLOCK = `Typography:

- Typography may adapt to the scene.

- Use elegant editorial typography.

- Title should be dominant but not loud.

- Body text should be calm, small, readable.

- Text must feel integrated into the poster, not pasted on top.`;



const DENTAL_PERSONAL_CARE_SCENE = `Personal-care scene direction:

A calm premium bathroom counter at morning light.

Soft ivory and warm gold tones.

Subtle water reflections.

Clean ceramic, glass, and small personal-care details.

A quiet decision-making atmosphere.

No medical claims.

No clinical before-after imagery.

No exaggerated whitening visuals.

No dental procedure scene.



Avoid:

- whitening transformation

- before-after teeth

- medical treatment result

- doctor endorsement

- dental procedure

- diseased teeth

- realistic mouth close-up

Avoid product-ad composition. The product should appear as a quiet personal-care object, not as a commercial hero product.`;



const AVOID_BLOCK = `Avoid:

- Generic AI art style

- Cyberpunk clichés

- Neon overload

- Childish mascot style

- Motivational poster clichés

- Social media template look

- Infographic look

- Too much text

- UI buttons, QR codes, watermarks`;



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

  const keywords = payload.visualKeywords.join(', ');

  const dentalCare = isDentalPersonalCarePayload(payload);



  const closing = payload.closingLine?.trim()

    ? `Closing line (optional): ${payload.closingLine}`

    : '';



  const blocks = [

    'Create a premium cinematic SAINA Conversation Mirror poster.',

    '',

    'Format:',

    'Vertical 4:5 poster, 1080x1350.',

    '',

    BRAND_SAFE_ZONE_RULES,

    '',

    SAINA_IDENTITY_BLOCK,

    '',

    'Season art direction:',

    season.labelTr + '.',

    season.palette,

    season.visualLanguage,

    '',

    'Conversation scope:',

    'This poster is based only on the active conversation thread.',

    '',

    'Selected topic:',

    payload.selectedTopic + '.',

    '',

    'Mirror title:',

    payload.mirrorTitle + '.',

    '',

    'Mirror text:',

    payload.mirrorText,

    closing,

    '',

    'Scene metaphor:',

    payload.sceneMetaphor + '.',

    '',

    'Visual keywords:',

    keywords + '.',

    '',

    'Emotional tone:',

    payload.emotionalTone + '.',

  ];



  if (dentalCare) {

    blocks.push('', DENTAL_PERSONAL_CARE_SCENE);

  }



  blocks.push(

    '',

    TYPOGRAPHY_BLOCK,

    '',

    COMPOSITION_BLOCK,

    '',

    AVOID_BLOCK

  );



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

  'neon cyberpunk',

  'mascot',

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

].join(', ');


