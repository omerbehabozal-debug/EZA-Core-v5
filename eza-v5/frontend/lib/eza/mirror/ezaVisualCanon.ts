/**
 * EZA Mirror — central visual canon (DNA, camera, materials, emotion, avoid rules).
 * All Daily Mirror scene prompts must read from this layer.
 */

/** Core visual DNA — premium editorial EZA universe. */
export const EZA_VISUAL_DNA = [
  'premium soft 3D realism',
  'editorial character illustration',
  'calm cinematic atmosphere',
  'warm golden-hour or soft diffused light',
  'elegant pastel muted palette',
  'elegant natural materials',
  'emotional but not childish',
  'intelligent and warm expression',
  'high detail but uncluttered',
  'shallow depth of field',
  'refined character design',
  'collectible premium product illustration',
  'no toy-like simplicity',
  'no cheap sticker style',
  'no childish cartoon look',
  'no plastic mascot look',
] as const;

/** Camera & framing language. */
export const EZA_CAMERA_LANGUAGE = [
  'medium shot or medium close-up',
  'eye-level camera',
  '70mm or 85mm editorial portrait feeling',
  'cinematic depth',
  'soft background blur',
  'character on the right or center-right of frame',
  'left side clean for text overlay',
  'bottom area calm for UI panels',
] as const;

/** Materials to favor. */
export const EZA_MATERIAL_USE = [
  'natural fabric',
  'wool linen cashmere texture feeling',
  'wood and stone',
  'matte ceramic',
  'soft metal accents',
  'quality notebook book accessories',
  'natural plants',
  'warm paper textures',
  'soft realistic material detail',
] as const;

/** Materials and looks to avoid (also in negative prompt). */
export const EZA_MATERIAL_AVOID = [
  'plastic toy surfaces',
  'glossy cheap 3D',
  'neon game aesthetic',
  'low detail surfaces',
  'overly simple figure',
  'child toy character materials',
] as const;

/** Emotional tone — mature, calm, trustworthy. */
export const EZA_EMOTIONAL_USE = [
  'calm',
  'wise',
  'non-judgmental',
  'trustworthy',
  'empathetic',
  'sincere',
  'peaceful',
  'elegant emotional expression',
] as const;

export const EZA_EMOTIONAL_AVOID = [
  'comedic child character',
  'overly cute toy',
  'caricature',
  'meme character',
  'baby face',
  'exaggerated cartoon proportions',
] as const;

/** Global style lock — one compact line, repeated in canon layers (Sprint 10D). */
export const EZA_GLOBAL_STYLE_LOCK =
  'EZA unified world: mature premium editorial character, refined cinematic 3D realism, elegant proportions, not toy-like not bean-like not plush not plastic mascot not childish not generic avatar, high-end animated film quality for adults, premium collectible character not a children\'s toy';

/** Premium stylized character lock — all character topics (Sprint 10G). */
export const EZA_PREMIUM_STYLIZED_CHARACTER_LOCK =
  'premium stylized cinematic character, mature and elegant, not photorealistic, not a real human portrait, not a bean mascot, not a toy, refined facial proportions, soft editorial 3D realism, high-end animated film character for adults, stylized but mature, cinematic but soft, emotional but not childish, warm eyes, natural fabric detail, painterly-soft realism, handcrafted editorial 3D, not Pixar child, not toy mascot';

/** Sprint 11G — mature editorial animated film aesthetic (character). */
export const EZA_EDITORIAL_CHARACTER_LOCK =
  'premium editorial animated film aesthetic, mature stylized facial proportions, subtle emotional realism, sophisticated cinematic character design, luxury animated feature tone for adults, understated emotional expression, refined eye spacing not oversized, natural fabric not plush toy texture';

/** Sprint 11J — context scene mismatch avoidance. */
export const EZA_CONTEXT_SCENE_NEGATIVE_AVOID = [
  'generic mascot scene',
  'floating character',
  'empty emotional portrait',
  'generic AI wallpaper',
  'generic cinematic portrait',
  'centered idle character',
  'static posing model',
  'symmetrical portrait framing',
  'straight-on centered portrait',
  'wallpaper composition',
  'flat single-plane composition',
  'AI mood wallpaper',
  'midjourney wallpaper aesthetic',
  'subject staring at camera',
  'idle standing character',
  'random panda',
  'posterized avatar',
  'generic inspirational scene',
  'unrelated calm portrait',
  'chat bubble',
  'chat screenshot',
  'laptop screen with messages',
  'UI screenshot',
  'readable text on screen',
  'prompt text visible',
] as const;

/** Sprint 11G — global mascot / cute avoidance (negative prompt). */
export const EZA_MASCOT_NEGATIVE_AVOID = [
  'mascot app character',
  'startup mascot',
  'plush texture',
  'plush toy',
  'oversized cartoon eyes',
  'kawaii expression',
  'childish softness',
  'toy face proportions',
  'sticker mascot energy',
  'cute app mascot',
  'children app character',
  'round cute face',
  'bean mascot face',
] as const;

/** Global negative — photoreal / bean / toy portrait risks (Sprint 10G). */
export const EZA_STYLIZED_NEGATIVE_AVOID = [
  'photorealistic portrait',
  'real human photo',
  'documentary portrait',
  'fashion model photo',
  'corporate headshot',
  'bean mascot',
  'round blob head',
  'toy character',
  'childish cartoon',
  'Pixar child face',
  'simple mascot',
  'low-end 3D avatar',
] as const;

/** Explicit prompt quality guardrails. */
export const EZA_PROMPT_QUALITY_RULES = [
  'not a toy',
  'not a child mascot',
  'mature premium editorial character',
  'premium stylized cinematic character',
  'not photorealistic human portrait',
  'refined proportions',
  'high-end animated film quality but not childish',
  'premium collectible character design',
  'not bean-like',
  'not plush',
  'soft editorial 3D realism',
  'no generic avatar',
  'no bean character',
  'no sticker illustration',
] as const;

/** Travel topic — extra negative tokens (Sprint 10D). */
export const TRAVEL_NEGATIVE_AVOID = [
  'bean head',
  'round blob character',
  'felt toy',
  'toddler proportions',
  'simplified mascot traveler',
  'toy explorer',
] as const;

/** Architecture topic — negative tokens (Sprint 10G). */
export const ARCHITECTURE_NEGATIVE_AVOID = [
  'photorealistic portrait',
  'real human photo',
  'corporate headshot',
  'fashion model photo',
  'documentary portrait',
  'bean animal',
  'bean character',
  'round blob head',
  'cat mascot',
  'toy architect',
  'mascot architect',
  'toy character',
  'giant foreground character',
  'character dominating the frame',
  'cartoon construction worker',
  'childish architect',
  'childish character',
  'Pixar child face',
  'generic avatar',
  'cartoon person',
  'cute animal',
  'construction toy',
  'central portrait composition',
  'plastic mascot',
  'simple mascot',
] as const;

/** Architecture — cinematic storytelling visual DNA (Sprint 10G). */
export const EZA_ARCHITECTURE_VISUAL_DNA = [
  'premium soft 3D realism',
  'cinematic architecture storytelling',
  'premium architectural lifestyle mood',
  'contemplative designer atmosphere',
  'emotional spatial atmosphere',
  'warm golden hour nostalgic travel-like atmosphere',
  'elegant pastel muted palette',
  'strong material texture',
  'high detail but uncluttered',
  'refined spatial atmosphere',
  'architecture remains visually important about 65 percent of frame',
  'character integrated into environment not dominating',
  'soft editorial realism not photorealistic',
] as const;

/** Architecture hero prompt — Sprint 10G core scene phrase. */
export const EZA_ARCHITECTURE_STORYTELLING_CORE =
  'a premium stylized cinematic designer character, mature and elegant, softly 3D rendered, standing or sitting in a historic stone courtyard, studying material samples or sketching quietly, architecture remains visible and important, warm golden hour, refined fabric textures, soft editorial realism, not photorealistic, not a real person, not a bean mascot';

/** Architecture — scene + integrated character (Sprint 10F). */
export const EZA_ARCHITECTURE_SCENE_RULES = [
  'cinematic architecture storytelling composition',
  'refined architectural courtyard historic stone facade',
  'material samples wood stone ceramic',
  'elegant shadows light and shadow geometry',
  'premium spatial atmosphere',
  'thoughtful architect in stone courtyard',
  'calm designer examining material samples',
  'designer watching sunset light in courtyard',
  'sketching figure among stone walls optional',
  'contemplative spatial mood',
  'left side clean for overlay',
  'bottom area calm for UI panels',
] as const;

export const EZA_ARCHITECTURE_CAMERA = [
  'wide editorial architectural composition',
  '28mm or 35mm cinematic architectural lens feeling',
  'eye-level or slightly elevated camera',
  'strong material texture and spatial depth',
  'clean negative space on left for shareable card overlay',
  'stylized character on right or right-lower only',
  'character about 25 to 35 percent of frame',
  'architecture about 65 percent of frame',
  'face softly stylized not photorealistic portrait',
  'not central portrait composition',
  'atmospheric soft background depth',
] as const;

export const EZA_ARCHITECTURE_OVERLAY_RULES = [
  'full editorial vertical scene for future interface overlays',
  'important subjects away from top and bottom edges',
  'emotional focal point near center of composition',
  'courtyard facade and materials remain visually strong',
  'character supports story without crowding the center focal area',
  'environment calm without visual clutter',
] as const;

/** Integrated architectural thinker — premium stylized (Sprint 10G). */
export const EZA_ARCHITECTURE_CHARACTER_VISUAL = [
  'premium stylized architect designer character',
  'soft cinematic 3D stylized face',
  'elegant proportions warm mature expression',
  'integrated into architectural atmosphere',
  'not photorealistic not real person not corporate portrait',
  'not dominating the frame',
] as const;

export const EZA_ARCHITECTURE_CHARACTER_AVOID =
  'photorealistic portrait, real human photo, corporate headshot, bean character, round blob head, toy architect, mascot architect, Pixar child face, plastic mascot, simple mascot';

export const ARCHITECTURE_QUALITY_HINTS = [
  'EZA Mirror — premium stylized cinematic character',
  'not photorealistic portrait',
  'character and space balanced',
  'textless scene only',
  '9:16 vertical safe composition',
  'left overlay zone kept clean',
  'not toy-like not bean-like',
] as const;

/** Extra negative-prompt tokens (merged into STANDARD_NEGATIVE_PROMPT). */
export const EZA_NEGATIVE_AVOID = [
  'childish',
  'toy',
  'bean-like',
  'plush',
  'plastic toy',
  'cheap mascot',
  'sticker',
  'bean character',
  'baby face',
  'cartoonish simple',
  'low detail',
  'overly cute',
  'exaggerated cartoon proportions',
  'generic avatar',
  'flat character',
  'cheap 3D',
  'plastic mascot',
  'chibi',
  'emoji style',
] as const;

/** Textless + card overlay layout (unchanged product rule). */
export const EZA_TEXTLESS_RULES = [
  'no text',
  'no typography',
  'no letters',
  'no numbers',
  'no logo',
  'no ui labels',
  'no signage',
  'no readable writing',
  'vertical 9:16 friendly composition',
] as const;

/** Architecture style contract (after textless rules — no character global lock). */
export const EZA_ARCHITECTURE_STYLE_CONTRACT = [
  ...EZA_ARCHITECTURE_VISUAL_DNA,
  'clean left side for UI overlay',
  ...EZA_TEXTLESS_RULES.filter((r) => r.startsWith('no ')),
].join(', ');

export const EZA_OVERLAY_LAYOUT_RULES = [
  'full editorial vertical scene for future interface overlays',
  'important subjects away from top and bottom edges',
  'emotional focal point near center of composition',
  'comfortable breathing space at edges without empty sterile bands',
  'environment reflects topic mood without visual clutter',
] as const;

/** Single-string legacy contract (composed from canon). */
export const EZA_VISUAL_STYLE_CONTRACT = [
  ...EZA_VISUAL_DNA,
  'clean left side for UI overlay',
  ...EZA_TEXTLESS_RULES.filter((r) => r.startsWith('no ')),
].join(', ');

export const STANDARD_NEGATIVE_PROMPT = [
  'text, letters, numbers, logo, watermark, signage, readable writing, captions, UI labels',
  'distorted anatomy, extra limbs, broken hands, creepy face',
  'messy background, cluttered dashboard, harsh contrast, dark gaming card style',
  'low quality, blurry, noisy, flat cartoon, cheap sticker style, over saturated colors',
  ...EZA_NEGATIVE_AVOID,
  ...EZA_STYLIZED_NEGATIVE_AVOID,
  ...EZA_MATERIAL_AVOID,
  ...EZA_EMOTIONAL_AVOID,
].join(', ');

export const PROMPT_COMPOSITION_RULES = [
  ...EZA_CAMERA_LANGUAGE,
  ...EZA_OVERLAY_LAYOUT_RULES,
  ...EZA_TEXTLESS_RULES,
];

export const VISUAL_QUALITY_HINTS = [
  'EZA visual canon — mature editorial character',
  'cinematic film still mood',
  'pastel cinematic lighting',
  'atmospheric depth soft vignette',
  'soft depth of field',
  'premium emotional framing',
  'textless scene only — card copy rendered in frontend',
  '9:16 vertical full canvas composition',
  'edge breathing room for overlays',
  'not toy-like not childish not mascot app',
] as const;

export const STYLE_PRESET = 'eza_mirror_professional_v1';

/** Ordered layers for visual prompt assembly. */
export function buildVisualCanonLayers(): string[] {
  return [
    EZA_VISUAL_STYLE_CONTRACT,
    EZA_GLOBAL_STYLE_LOCK,
    EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
    EZA_EDITORIAL_CHARACTER_LOCK,
    'cinematic film still atmosphere',
    'atmospheric depth soft vignette lighting',
    'premium mood editorial framing',
    ...EZA_CAMERA_LANGUAGE,
    `materials: ${EZA_MATERIAL_USE.join(', ')}`,
    `emotional tone: ${EZA_EMOTIONAL_USE.join(', ')}`,
    ...EZA_PROMPT_QUALITY_RULES,
  ];
}

/** Topic-aware negative prompt (base + travel/architecture augments). */
export function buildMirrorNegativePrompt(
  topicKey?: string,
  extraAvoid?: readonly string[]
): string {
  const mascot = EZA_MASCOT_NEGATIVE_AVOID.join(', ');
  const context = EZA_CONTEXT_SCENE_NEGATIVE_AVOID.join(', ');
  const extra = extraAvoid?.length ? `, ${extraAvoid.join(', ')}` : '';
  const base = `${STANDARD_NEGATIVE_PROMPT}, ${mascot}, ${context}${extra}`;
  if (topicKey === 'travel') {
    return `${base}, ${TRAVEL_NEGATIVE_AVOID.join(', ')}`;
  }
  if (topicKey === 'architecture') {
    return `${base}, ${ARCHITECTURE_NEGATIVE_AVOID.join(', ')}`;
  }
  return base;
}

/** Architecture cinematic storytelling — premium stylized (Sprint 10G). */
export function buildArchitectureStorytellingPhrase(behaviorCharacterName = ''): string {
  const name = behaviorCharacterName.trim();
  const presence = name
    ? `behavior-inspired presence: ${name}, stylized designer in this courtyard`
    : 'stylized designer in this courtyard';
  return [
    EZA_ARCHITECTURE_STORYTELLING_CORE,
    EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
    ...EZA_ARCHITECTURE_SCENE_RULES.slice(0, 6),
    ...EZA_ARCHITECTURE_CHARACTER_VISUAL,
    `avoid: ${EZA_ARCHITECTURE_CHARACTER_AVOID}`,
    presence,
    'shareable premium EZA Mirror card mood warm cinematic light like travel scenes',
    'not a cold architectural render website image',
  ].join(', ');
}

/** @deprecated Use buildArchitectureStorytellingPhrase */
export function buildArchitectureScenePhrase(behaviorCharacterName = ''): string {
  return buildArchitectureStorytellingPhrase(behaviorCharacterName);
}
