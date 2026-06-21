/**
 * V3.2 — cinematography, shot rotation, and reference tier for OpenAI poster prompts.
 */

import type { SainaMirrorSeason } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';

export type ShotMode =
  | 'documentary_wide'
  | 'editorial_medium'
  | 'intimate_detail'
  | 'macro_material'
  | 'window_light_tableau'
  | 'walking_away_silhouette';

export type ReferenceTier =
  | 'a24_quiet_drama'
  | 'kinfolk_documentary'
  | 'monocle_editorial_grid'
  | 'apple_editorial'
  | 'natgeo_premium_cover';

export const SHOT_MODE_DESCRIPTIONS: Record<ShotMode, string> = {
  documentary_wide:
    '35mm documentary wide frame, environmental storytelling, human scale, restrained composition',
  editorial_medium:
    '50mm editorial medium frame, controlled subject placement, premium magazine cover feeling',
  intimate_detail:
    '85mm intimate detail frame, shallow depth, tactile emotional focus',
  macro_material:
    'tactile macro material study, surfaces, hands, texture, restrained luxury',
  window_light_tableau:
    'quiet window-light interior tableau, one motivated light source, layered depth',
  walking_away_silhouette:
    'figure walking away at small scale, atmospheric distance, no golden-postcard centering',
};

const STANDARD_SHOT_MODES: readonly ShotMode[] = [
  'documentary_wide',
  'editorial_medium',
  'intimate_detail',
  'macro_material',
  'window_light_tableau',
];

const REFERENCE_TIER_DESCRIPTIONS: Record<ReferenceTier, string> = {
  a24_quiet_drama:
    'A24 quiet drama — restrained, emotionally charged, one iconic image, strong negative space, no spectacle.',
  kinfolk_documentary:
    'Kinfolk documentary intimacy — soft natural light, human scale, tactile details, quiet composition, no staged glamour.',
  monocle_editorial_grid:
    'Monocle editorial grid — precise alignment, architectural clarity, intelligent negative space, premium magazine discipline.',
  apple_editorial:
    'Apple editorial — surgical lighting, material truth, ultra-clean geometry, zero clutter, product-grade polish.',
  natgeo_premium_cover:
    'National Geographic premium cover — documentary authenticity, epic scale with human anchor, lens truth, no tourist brochure.',
};

function hashMod(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return Math.abs(h) % mod;
}

/** Deterministic shot mode — evidence posters never use walking-away silhouette cliché. */
export function resolveShotMode(
  seed: string,
  options?: { hasConcreteEvidence?: boolean }
): { mode: ShotMode; description: string } {
  const roll = hashMod(`${seed}-v32-shot`, 5);
  if (!options?.hasConcreteEvidence && roll === 0) {
    const mode: ShotMode = 'walking_away_silhouette';
    return { mode, description: SHOT_MODE_DESCRIPTIONS[mode] };
  }
  const mode = STANDARD_SHOT_MODES[hashMod(`${seed}-v32-shot-pick`, STANDARD_SHOT_MODES.length)]!;
  return { mode, description: SHOT_MODE_DESCRIPTIONS[mode] };
}

/** One reference tier per prompt — avoids conflicting style signals. */
export function resolveReferenceTier(seed: string, season: SainaMirrorSeason): ReferenceTier {
  const tiers: ReferenceTier[] = [
    'a24_quiet_drama',
    'kinfolk_documentary',
    'monocle_editorial_grid',
    'apple_editorial',
    'natgeo_premium_cover',
  ];
  const seasonBias: Partial<Record<SainaMirrorSeason, ReferenceTier>> = {
    film_poster: 'a24_quiet_drama',
    editorial_magazine: 'monocle_editorial_grid',
    golden_hour: 'natgeo_premium_cover',
    quiet_luxury: 'kinfolk_documentary',
    bright_cinematic: 'apple_editorial',
    night_discovery: 'a24_quiet_drama',
  };
  const biased = seasonBias[season];
  if (biased && hashMod(`${seed}-v32-ref-bias`, 3) === 0) {
    return biased;
  }
  return hashPick(`${seed}-v32-reference`, tiers) as ReferenceTier;
}

export function getReferenceTierBlock(tier: ReferenceTier): string {
  return `Reference tier:\n${REFERENCE_TIER_DESCRIPTIONS[tier]}`;
}

export const CINEMATOGRAPHY_CONTRACT = `Cinematography contract:
- One hero anchor only: person OR object OR architectural detail, never a checklist scene.
- Camera language must be specific and photographic.
- Use one shot grammar per card (assigned in Shot mode below).
- Frame is vertical 4:5.
- Subject must sit on left or right third unless the season explicitly needs centered editorial composition.
- Reserve 35–45% negative space for typography.
- Use mandatory depth layers: foreground texture, midground subject, soft background atmosphere.
- Avoid centered postcard composition.
- Avoid tourist-brochure framing.
- Avoid generic golden-horizon silhouette unless film_poster season explicitly chooses it.`;

export const TYPOGRAPHY_GRID_CONTRACT = `Typography grid:
- The poster typography must be part of the image composition, not a UI overlay.
- Title zone: upper 18–28% or lower 18–28% of the frame depending on scene balance.
- Body copy: maximum 2–3 lines.
- Body width: 60–75% of frame.
- Title scale must be 2.5–3.5× body text scale.
- Use refined editorial tracking and leading.
- Turkish characters must render correctly: ı, ş, ğ, ü, ö, ç.
- Avoid centered motivational quote stack unless season is film_poster.
- Avoid checklist typography.
- Avoid UI-card typography.
- Avoid too many text blocks.`;

export const VISUAL_METAPHOR_TRANSLATION = `Visual metaphor translation:
- Interpret the topic through atmosphere, light, scale and material.
- Do not render literal keyword lists.
- Travel means distance through light and air, not landmarks.
- Architecture means memory, material, proportion and human scale, not villa renders.
- AI means human reflection and invisible connections, not robots, holograms or neon circuits.
- Personal care means trust, ritual and quiet choice, not product advertisement.
- Cars mean decision, movement and long-term comfort, not showroom advertising.
- Spiritual topics mean silence, direction and inner space, not preaching or religious cliché.`;

export const ART_DIRECTION_AVOID_BLOCK = `Avoid:
- stock photo smiling tourist
- centered motivational quote layout
- oversaturated HDR
- fake lens flare
- AI gloss
- plastic skin
- 3D architectural render
- CGI villa
- Pinterest filter pack
- generic drone landscape
- symmetrical pagoda/temple checklist
- robot
- neon circuit brain
- tourism brochure
- product advertisement
- commercial hero product
- dashboard
- charts
- scores
- checklist layout
- UI card template
- generic AI art
- cyberpunk clichés
- motivational poster
- infographic`;
