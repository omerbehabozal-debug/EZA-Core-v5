/**
 * P4-A — Mirror Moment-first full canvas prompt block for OpenAI.
 */

import type { DailyNarrativeLayer } from '@/lib/eza/mirror/narrativeTypes';
import { getSceneArchetypePhrase } from '@/lib/eza/mirror/sceneArchetypeEngine';

const FULL_CANVAS_OPENING = [
  'Generate a full editorial vertical scene for a 1080 by 1920 canvas',
  'the entire frame is one cinematic story',
  'not a card, infographic, UI mockup, poster layout, app screen, or screenshot',
  'no text, typography, labels, charts, buttons, logos, captions, or interface elements',
  'future interface overlays will be added separately in frontend',
].join(', ');

const SAFE_COMPOSITION = [
  'important visual subjects should stay away from the top and bottom edges',
  'leave comfortable visual breathing space for future interface overlays',
  'keep the emotional focal point around the center of the composition',
  'avoid placing critical visual elements near the top and bottom edges',
].join(', ');

const EDITORIAL_STYLE = [
  'premium, cinematic, editorial, human, thoughtful, shareable, emotionally meaningful',
  'avoid cartoon, emoji, game art, sticker, children book illustration, cute mascot',
].join(', ');

const LITERAL_MASCOT_AVOID = [
  'do not depict a panda, fox, animal doctor mascot, cartoon animal, or literal character costume',
  'no plush toy, no children book character, no sticker mascot',
].join(', ');

const IDENTITY_MOOD_LENS: Record<string, string> = {
  still_lake: 'still reflective calm, clarity before movement, metaphoric water stillness not a lake character portrait',
  horizon_explorer: 'horizon-seeking curiosity, forward-looking calm, not a literal explorer mascot',
  pathfinder: 'thoughtful route contemplation, quiet directional calm, not a map-holding cartoon',
  idea_architect: 'shaping possibility into form, creative focus without architect costume',
  creative_chameleon: 'creative flow and inspired motion, not a literal chameleon character',
  gentle_deer: 'gentle wellness presence, soft care atmosphere, not a doctor deer or animal portrait',
  compassionate_deer: 'caring guardian atmosphere, space for healing and reflection, not medical mascot',
  calm_panda: 'peaceful mindful calm, clarity emerging in landscape, not a panda reading or posing',
  curious_fox: 'subtle curiosity in atmosphere, not a fox guide character',
  decision_penguin: 'calm decision poise in human-scale figure, not a penguin mascot',
  balance_scales: 'symbolic balance mood, not cartoon scales character',
  clear_lock: 'quiet assurance and thoughtful pause, not a lock mascot',
  quiet_observer: 'observational calm, reflective stillness, not portrait posing',
  harmony_circle: 'balanced harmonious calm, circular soft rhythm in environment',
  default: 'quiet editorial human mood, reflective calm, no mascot or costume',
};

export const NARRATIVE_NEGATIVE_PROMPT_EXTRAS = [
  'poster',
  'card',
  'infographic',
  'dashboard',
  'UI',
  'app screen',
  'screenshot',
  'typography',
  'readable text',
  'logo',
  'label',
  'chart',
  'button',
  'widget',
  'interface',
  'caption',
  'quote',
  'watermark',
  'mascot',
  'sticker',
  'cartoon animal',
  "children's book illustration",
] as const;

export function buildIdentityMoodLens(
  dailyAvatarId: string,
  dailyAvatarName?: string
): string {
  const byId = IDENTITY_MOOD_LENS[dailyAvatarId];
  if (byId) return byId;
  if (dailyAvatarName?.includes('Göl')) {
    return IDENTITY_MOOD_LENS.still_lake;
  }
  return IDENTITY_MOOD_LENS.default;
}

export type FullCanvasNarrativePromptInput = Pick<
  DailyNarrativeLayer,
  | 'mirrorMoment'
  | 'storyTensionTitle'
  | 'storyTensionSummary'
  | 'sceneArchetypeId'
  | 'dailyThemeTitle'
  | 'dailyAvatarId'
  | 'dailyAvatarName'
  | 'identityMoodLens'
>;

export function buildThemeAtmospherePhrase(themeTitle: string, narrativeCoreId?: string): string {
  const t = themeTitle.trim();
  const map: Record<string, string> = {
    'Araç Kararı': 'premium vehicle decision, comfort and long-distance focus, warm restrained editorial light',
    'Mimari Tasarım': 'architectural design atmosphere, material and form study, warm workshop light',
    'Semerkant Yolculuğu': 'travel discovery atmosphere, heritage horizon, warm morning editorial light',
    'Sağlık & İyilik': 'gentle wellness space, restorative calm, soft diffused light',
    'Finansal Karar': 'calm planning atmosphere, thoughtful financial mood, soft neutral light',
    'Keşif Yolculuğu': 'travel discovery horizon, exploratory editorial morning light',
    'Yaratıcı Akış': 'creative studio flow, inspiration boards, soft sunset light',
    'İlişki & Bağ': 'warm connection atmosphere, empathetic calm editorial light',
    'Günün Düşüncesi': 'quiet reflective editorial space, soft neutral light',
  };
  return map[t] ?? `quiet editorial daily theme atmosphere aligned with ${narrativeCoreId ?? 'reflection'}`;
}

export function buildFullCanvasNarrativePromptBlock(
  input: FullCanvasNarrativePromptInput & { narrativeCoreId?: string }
): string {
  const archetypePhrase = getSceneArchetypePhrase(input.sceneArchetypeId);
  const moodLens = input.identityMoodLens || buildIdentityMoodLens(input.dailyAvatarId, input.dailyAvatarName);
  const themeAtmosphere = buildThemeAtmospherePhrase(input.dailyThemeTitle, input.narrativeCoreId);

  return [
    FULL_CANVAS_OPENING,
    `visual moment: ${input.mirrorMoment}`,
    `story tension: ${input.storyTensionTitle}. ${input.storyTensionSummary}`,
    `scene archetype: ${archetypePhrase}`,
    `theme atmosphere: ${themeAtmosphere}`,
    `identity mood lens: ${moodLens}. ${LITERAL_MASCOT_AVOID}`,
    SAFE_COMPOSITION,
    EDITORIAL_STYLE,
  ].join(', ');
}

const FULL_CANVAS_ANCHOR = 'generate a full editorial vertical scene';

/** Assert prompt order for tests — moment before tension before archetype (P4-A block only). */
export function narrativePromptSectionOrder(prompt: string): {
  momentIdx: number;
  tensionIdx: number;
  archetypeIdx: number;
  themeIdx: number;
  lensIdx: number;
} {
  const lower = prompt.toLowerCase();
  const anchor = lower.indexOf(FULL_CANVAS_ANCHOR);
  const slice = anchor >= 0 ? lower.slice(anchor) : lower;
  return {
    momentIdx: slice.indexOf('visual moment:'),
    tensionIdx: slice.indexOf('story tension:'),
    archetypeIdx: slice.indexOf('scene archetype:'),
    themeIdx: slice.indexOf('theme atmosphere:'),
    lensIdx: slice.indexOf('identity mood lens:'),
  };
}
