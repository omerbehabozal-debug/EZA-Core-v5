/**
 * Weekly / periodical art direction seasons for Mirror V2 posters.
 */

import type { SainaMirrorSeason } from '@/lib/eza/mirror/conversationMirrorV2/types';

export type MirrorSeasonProfile = {
  id: SainaMirrorSeason;
  labelTr: string;
  mood: string;
  palette: string;
  visualLanguage: string;
  promptBlock: string;
};

export const MIRROR_SEASON_REGISTRY: Record<SainaMirrorSeason, MirrorSeasonProfile> = {
  bright_cinematic: {
    id: 'bright_cinematic',
    labelTr: 'Aydınlık Sinematik',
    mood: 'Hopeful, warm, clear, elegant.',
    palette: 'Warm gold, ivory, soft teal, pale sky, natural shadows.',
    visualLanguage:
      'Premium editorial photography, cinematic sunlight, human-centered composition, soft depth of field, quiet luxury, golden-hour atmosphere.',
    promptBlock: `Season art direction:
Aydınlık Sinematik

Mood:
Hopeful, warm, clear, elegant.

Palette:
Warm gold, ivory, soft teal, pale sky, natural shadows.

Visual language:
Premium editorial photography,
cinematic sunlight,
human-centered composition,
soft depth of field,
quiet luxury,
golden-hour atmosphere.`,
  },
  night_discovery: {
    id: 'night_discovery',
    labelTr: 'Gece ve Keşif',
    mood: 'Deep, quiet, mysterious, thoughtful.',
    palette: 'Navy, deep teal, warm gold, city lights, wet reflections.',
    visualLanguage:
      'Cinematic night photography, rain reflections, quiet urban atmosphere, soft bokeh, subtle golden highlights.',
    promptBlock: `Season art direction:
Gece ve Keşif

Mood:
Deep, quiet, mysterious, thoughtful.

Palette:
Navy, deep teal, warm gold, city lights, wet reflections.

Visual language:
Cinematic night photography,
rain reflections,
quiet urban atmosphere,
soft bokeh,
subtle golden highlights.`,
  },
  editorial_magazine: {
    id: 'editorial_magazine',
    labelTr: 'Editorial Magazine',
    mood: 'Refined, calm, intelligent, curated.',
    palette: 'Ivory, charcoal, muted gold, soft natural tones.',
    visualLanguage:
      'Luxury magazine cover, Monocle / Kinfolk style, clean composition, strong negative space, premium editorial typography.',
    promptBlock: `Season art direction:
Editorial Magazine

Mood:
Refined, calm, intelligent, curated.

Palette:
Ivory, charcoal, muted gold, soft natural tones.

Visual language:
Luxury magazine cover,
Monocle / Kinfolk style,
clean composition,
strong negative space,
premium editorial typography.`,
  },
  film_poster: {
    id: 'film_poster',
    labelTr: 'Film Posteri',
    mood: 'Dramatic, emotional, memorable.',
    palette: 'Deep contrast, gold highlights, cinematic shadows.',
    visualLanguage:
      'A24-style quiet drama, cinematic poster layout, single strong scene, human silhouette, powerful atmosphere.',
    promptBlock: `Season art direction:
Film Posteri

Mood:
Dramatic, emotional, memorable.

Palette:
Deep contrast, gold highlights, cinematic shadows.

Visual language:
A24-style quiet drama,
cinematic poster layout,
single strong scene,
human silhouette,
powerful atmosphere.`,
  },
  quiet_luxury: {
    id: 'quiet_luxury',
    labelTr: 'Sessiz Lüks',
    mood: 'Understated, intimate, premium, still.',
    palette: 'Deep charcoal, muted teal, soft ivory, restrained gold accents.',
    visualLanguage:
      'Quiet luxury interior, tactile materials, soft window light, minimal composition, editorial restraint.',
    promptBlock: `Season art direction:
Sessiz Lüks

Mood:
Understated, intimate, premium, still.

Palette:
Deep charcoal, muted teal, soft ivory, restrained gold accents.

Visual language:
Quiet luxury interior,
tactile materials,
soft window light,
minimal composition,
editorial restraint.`,
  },
  golden_hour: {
    id: 'golden_hour',
    labelTr: 'Altın Saat',
    mood: 'Warm, open, reflective, gently optimistic.',
    palette: 'Amber gold, honey light, soft shadows, pale horizon.',
    visualLanguage:
      'Golden hour photography, long shadows, warm haze, cinematic landscape, human scale in frame.',
    promptBlock: `Season art direction:
Altın Saat

Mood:
Warm, open, reflective, gently optimistic.

Palette:
Amber gold, honey light, soft shadows, pale horizon.

Visual language:
Golden hour photography,
long shadows,
warm haze,
cinematic landscape,
human scale in frame.`,
  },
};

const SEASON_ROTATION: SainaMirrorSeason[] = [
  'bright_cinematic',
  'night_discovery',
  'editorial_magazine',
  'film_poster',
  'quiet_luxury',
  'golden_hour',
];

/** ISO week number for seasonal rotation. */
function isoWeekKey(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function resolveActiveSeason(
  date: Date = new Date(),
  override?: SainaMirrorSeason
): MirrorSeasonProfile {
  if (override) return MIRROR_SEASON_REGISTRY[override];
  const week = isoWeekKey(date);
  const seasonId = SEASON_ROTATION[week % SEASON_ROTATION.length]!;
  return MIRROR_SEASON_REGISTRY[seasonId];
}

export function getSeasonProfile(season: SainaMirrorSeason): MirrorSeasonProfile {
  return MIRROR_SEASON_REGISTRY[season];
}
