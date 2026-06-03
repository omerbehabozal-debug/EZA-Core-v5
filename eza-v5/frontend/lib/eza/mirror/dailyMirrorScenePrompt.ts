/**
 * P1 — Daily Mirror identity → textless scene prompt (avatar + theme + concept).
 */

import type { CharacterArchetypeId } from '@/lib/eza/mirror/ezaCharacterBible';
import { buildCharacterBiblePhrase } from '@/lib/eza/mirror/ezaCharacterBible';
import type { DailyAvatarType } from '@/lib/eza/mirror/dailyAvatarRegistry';

export type DailyMirrorIdentityPromptInput = {
  dailyAvatarId?: string;
  dailyAvatarName?: string;
  dailyAvatarType?: DailyAvatarType;
  dailyAvatarArchetypeId?: CharacterArchetypeId;
  dailyThemeTitle?: string;
  dailySceneConcept?: string;
};

const AVATAR_ID_SCENE_PHRASE: Record<string, string> = {
  curious_fox: 'a curious fox-like guide observing subtle clues',
  research_owl: 'a research owl studying subtle clues',
  horizon_explorer: 'a thoughtful horizon explorer studying routes and distance',
  stargazer: 'a stargazer studying maps under soft night light',
  sprouting_seedling: 'a sprouting seedling metaphor for quiet new growth',
  pathfinder: 'a pathfinder tracing a thoughtful route',
  decision_penguin: 'a calm decision-maker weighing options with poise',
  balance_scales: 'a symbolic balance moment between two choices',
  route_mapper: 'a route mapper sketching direction on a journal',
  clarity_owl: 'a clarity owl with sharp calm focus',
  idea_architect: 'a creative architect shaping ideas in studio light',
  creative_chameleon: 'a creative chameleon-like spirit with vivid ideas',
  thoughtful_hedgehog: 'a thoughtful hedgehog in deep quiet study',
  compassionate_deer: 'a compassionate deer in gentle wellness light',
  swift_squirrel: 'a swift squirrel in focused practical motion',
  calm_panda: 'a calm panda in mindful editorial balance',
  verifying_crow: 'a verifying crow inspecting details twice',
};

const ARCHETYPE_SCENE_PHRASE: Record<CharacterArchetypeId, string> = {
  journey_traveler: 'a thoughtful horizon explorer',
  wise_owl: 'a research owl studying subtle clues',
  creative_spirit: 'a creative spirit in inspired editorial motion',
  calm_panda: 'a calm mindful editorial character',
  compassionate_deer: 'a compassionate deer guide with soft presence',
  bridge_builder: 'a warm bridge-builder connecting perspectives',
};

const THEME_TITLE_SCENE_PHRASE: Record<string, string> = {
  'Semerkant Yolculuğu':
    'Samarkand Registan-inspired route planning, travel discovery atmosphere, warm morning light',
  'Mimari Tasarım':
    'architectural model studio, restoration sketches, warm design atmosphere',
  'Finansal Karar':
    'calm decision table, symbolic charts, thoughtful financial planning mood',
  'Sağlık & İyilik':
    'gentle wellness space, restorative light, calm care atmosphere',
  'Ürün Stratejisi':
    'product strategy studio, roadmap boards, focused planning mood',
  'Araç Kararı':
    'premium showroom comparison mood, comfort-focused decision atmosphere',
  'İlişki & Bağ':
    'lakeside empathy bridge, warm connection atmosphere',
  'Yaratıcı Akış':
    'creative studio flow, inspiration boards, soft sunset light',
  'Keşif Yolculuğu':
    'travel discovery horizon, route journal, exploratory morning light',
  'Günün Düşüncesi':
    'quiet reflective editorial space, soft neutral light, calm thought mood',
};

const CONCEPT_KEYWORD_PHRASE: [RegExp, string][] = [
  [/semerkant|samarkand|registan|meydan/i, 'studying routes in Registan Square, Samarkand'],
  [/mimari|villa|restorasyon|architecture/i, 'examining architectural form and material choices'],
  [/finans|bütçe|yatırım|finance/i, 'reviewing financial plans with calm focus'],
  [/sağlık|wellness|iyi oluş/i, 'in a restorative wellness moment'],
  [/ürün|strateji|roadmap|product/i, 'shaping product direction with clarity'],
  [/bmw|mercedes|araç|otomobil/i, 'comparing comfort-focused vehicle options'],
  [/rota|yolculuk|keşif|travel/i, 'studying travel routes with curiosity'],
];

const PII_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
  /\+?\d[\d\s().-]{8,}\d/g,
  /https?:\/\/\S+/gi,
];

const MAX_SCENE_MOMENT_LEN = 200;

function avatarTypeModifier(type: DailyAvatarType | undefined): string {
  switch (type) {
    case 'animal':
      return 'stylized editorial animal character, not plush toy';
    case 'plant':
      return 'botanical metaphor in scene, organic editorial still life';
    case 'metaphor':
      return 'symbolic editorial metaphor integrated in scene';
    case 'object':
      return 'symbolic object focal point with human-scale context';
    case 'human':
      return 'premium stylized human editorial character';
    default:
      return 'premium editorial character';
  }
}

export function buildDailyAvatarScenePhrase(
  input: Pick<
    DailyMirrorIdentityPromptInput,
    'dailyAvatarId' | 'dailyAvatarArchetypeId' | 'dailyAvatarType' | 'dailyAvatarName'
  >
): string | null {
  if (!input.dailyAvatarArchetypeId && !input.dailyAvatarId) {
    return null;
  }

  const byId =
    input.dailyAvatarId && AVATAR_ID_SCENE_PHRASE[input.dailyAvatarId]
      ? AVATAR_ID_SCENE_PHRASE[input.dailyAvatarId]
      : null;

  const archetype = input.dailyAvatarArchetypeId;
  const byArchetype = archetype ? ARCHETYPE_SCENE_PHRASE[archetype] : null;

  const core = byId ?? byArchetype;
  if (!core) {
    if (archetype) {
      return buildCharacterBiblePhrase(archetype, input.dailyAvatarName ?? '');
    }
    return null;
  }

  return [core, avatarTypeModifier(input.dailyAvatarType)].join(', ');
}

export function buildDailyThemeScenePhrase(dailyThemeTitle?: string): string | null {
  if (!dailyThemeTitle?.trim()) return null;
  const title = dailyThemeTitle.trim();
  return (
    THEME_TITLE_SCENE_PHRASE[title] ??
    'quiet editorial daily theme atmosphere, soft cinematic light'
  );
}

/**
 * Sanitize dailySceneConcept for image prompt — no PII, bounded length, English-safe moment.
 */
export function sanitizeDailySceneConceptForPrompt(
  concept: string | undefined,
  dailyThemeTitle?: string
): string | null {
  if (!concept?.trim()) return null;

  let working = concept.trim();
  for (const re of PII_PATTERNS) {
    working = working.replace(re, '');
  }
  working = working.replace(/\s+/g, ' ').trim();
  if (!working) return null;

  const blob = working.toLowerCase();
  for (const [re, phrase] of CONCEPT_KEYWORD_PHRASE) {
    if (re.test(blob)) {
      return phrase.slice(0, MAX_SCENE_MOMENT_LEN);
    }
  }

  if (dailyThemeTitle && THEME_TITLE_SCENE_PHRASE[dailyThemeTitle.trim()]) {
    return 'editorial scene moment aligned with daily theme, reflective calm action';
  }

  return 'quiet editorial scene moment, reflective calm action';
}

export function buildDailyIdentityPromptBlock(
  input: DailyMirrorIdentityPromptInput
): string | null {
  const avatarPhrase = buildDailyAvatarScenePhrase(input);
  const themePhrase = buildDailyThemeScenePhrase(input.dailyThemeTitle);
  const momentPhrase = sanitizeDailySceneConceptForPrompt(
    input.dailySceneConcept,
    input.dailyThemeTitle
  );

  if (!avatarPhrase && !themePhrase && !momentPhrase) {
    return null;
  }

  const parts = [
    'textless cinematic daily mirror identity scene',
    avatarPhrase ? `character: ${avatarPhrase}` : '',
    themePhrase ? `theme environment: ${themePhrase}` : '',
    momentPhrase ? `scene moment: ${momentPhrase}` : '',
    'no text, no typography, no letters, no numbers, no logo, no signage, no readable writing',
  ].filter(Boolean);

  return parts.join(', ');
}

export function dailyIdentitySeedParts(input: DailyMirrorIdentityPromptInput): string[] {
  return [
    input.dailyAvatarId ?? '',
    input.dailyAvatarArchetypeId ?? '',
    input.dailyThemeTitle ?? '',
    sanitizeDailySceneConceptForPrompt(input.dailySceneConcept, input.dailyThemeTitle) ?? '',
  ];
}
