/**
 * Daily Mirror Poster — UI-only content derivation (no backend changes).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS } from '@/lib/eza/personaAssets';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';

export type PosterActivityRow = {
  label: string;
  value: string;
};

export type PosterRelationshipBar = {
  label: string;
  percent: number;
};

export type PosterCardContent = {
  characterEmoji: string;
  characterGradient: string;
  journeyHeadline: string;
  themeTitle: string;
  themeDescription: string;
  quote: string;
  storyLine: string;
  activities: PosterActivityRow[];
  energyDisplay: string;
  energyPercent: number;
  relationshipBars: PosterRelationshipBar[];
};

/** Poster copy limits (≈2 lines at card width). */
export const POSTER_STORY_MAX = 128;
export const POSTER_THEME_DESC_MAX = 72;
export const POSTER_QUOTE_MAX = 96;
export const POSTER_RELATION_LINE_MAX = 52;

const QUOTE_FALLBACKS = [
  'Bazı cevaplar hemen değil, zamanla netleşir.',
  'Kendini anlamak da bir ilerleme biçimidir.',
  'Küçük netlikler bazen büyük değişimlerden değerlidir.',
];

const TONE_THEME_DESCRIPTION: Partial<Record<ReflectionToneId, string>> = {
  emotionally_open: 'Empati ve bağ kurma alanı açık.',
  thoughtful: 'Sorgulayan ama sakin bir zihin.',
  mentally_tired: 'Yumuşak tempo, içe dönük bir gün.',
  curious_light: 'Hafif merak ve açık ufuk.',
  rebuilding: 'Yeniden toparlanma ve küçük adımlar.',
  focused_growth: 'Net yön ve ölçülü ilerleme.',
  emotionally_cautious: 'Özenli ve koruyucu bir tempo.',
  quietly_confident: 'Sakin iç güven ve netlik.',
  calm_reflective: 'Düşüncene alan açan sakin bir tempo.',
};

const THEME_FROM_TOPIC: Record<string, { title: string; description: string }> = {
  'sağlık ve iyi oluş': {
    title: 'SAĞLIK & İYİLİK',
    description: 'Bedenine ve ritmine alan açtığın bir gün.',
  },
  'finans ve planlama': {
    title: 'PLAN & DENGE',
    description: 'Net adımlar, sakin bir zihin.',
  },
  'arkadaşlık ve ilişki': {
    title: 'DOSTLUK & UYUM',
    description: 'Küçük bir adım, büyük bir değişimin başlangıcı olabilir.',
  },
  'seyahat ve keşif': {
    title: 'KEŞİF & UFUK',
    description: 'Merakın seni yeni bir perspektife taşıyor.',
  },
  'mimari ve yapı': {
    title: 'YAPI & NETLİK',
    description: 'Düzen, iç huzurun için bir köprü olabilir.',
  },
  'yaratıcılık ve ilham': {
    title: 'İLHAM & YARATIM',
    description: 'Fikirlerin bugün daha görünür hale geliyor.',
  },
  'genel düşünce': {
    title: 'DÜŞÜNCE & DENGE',
    description: 'Sakin bir tempo, net bir yön.',
  },
};

const FAMILY_THEME: Record<PersonaFamilyId, { title: string; description: string }> = {
  balanced_calm: { title: 'DÜŞÜNCE & DENGE', description: 'Sakin bir tempo, net bir yön.' },
  sensitive_careful: {
    title: 'DOSTLUK & UYUM',
    description: 'Empati ve sabır bugün öne çıkıyor.',
  },
  decision_direction: { title: 'PLAN & DENGE', description: 'Kararlarına alan açıyorsun.' },
  planning_structure: { title: 'YAPI & NETLİK', description: 'Yapı, iç huzur için köprü olabilir.' },
  curiosity_exploration: {
    title: 'KEŞİF & UFUK',
    description: 'Merakın seni yeni bir perspektife taşıyor.',
  },
  ideation_creation: {
    title: 'İLHAM & YARATIM',
    description: 'Fikirlerin bugün daha görünür.',
  },
  deep_thinking: { title: 'DERİNLİK & ANLAM', description: 'Düşüncene zaman ayırdın.' },
  clarity_simplification: {
    title: 'NETLİK & SADELEŞME',
    description: 'Karmaşayı sakin adımlarla çözüyorsun.',
  },
  fast_practical: { title: 'PRATİK & AKIŞ', description: 'Hızlı ama ölçülü ilerliyorsun.' },
  trust_verification: {
    title: 'GÜVEN & DOĞRULAMA',
    description: 'Soruların seni daha sağlam bir yere götürüyor.',
  },
};

export const CHARACTER_NAME_GRADIENT: Record<string, string> = {
  violet: 'from-violet-500 via-fuchsia-500 to-violet-700',
  sky: 'from-sky-500 via-blue-500 to-indigo-600',
  teal: 'from-teal-500 via-emerald-500 to-teal-700',
  amber: 'from-amber-500 via-orange-400 to-rose-500',
  indigo: 'from-indigo-500 via-violet-500 to-indigo-700',
  rose: 'from-rose-500 via-pink-500 to-fuchsia-600',
  orange: 'from-orange-500 via-amber-500 to-orange-700',
  slate: 'from-slate-600 via-violet-500 to-slate-700',
  blue: 'from-blue-500 via-sky-500 to-blue-700',
  stone: 'from-stone-500 via-violet-400 to-stone-600',
};

function hashPick(seed: string, items: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 7)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function deriveTheme(card: DailyMirrorCardModel): { title: string; description: string } {
  const topic = card.visual?.topicLabel?.toLowerCase().trim();
  const base =
    topic && THEME_FROM_TOPIC[topic]
      ? THEME_FROM_TOPIC[topic]
      : FAMILY_THEME[card.personaFamilyId] ?? THEME_FROM_TOPIC['genel düşünce']!;
  const toneDesc =
    (card.reflectionTone && TONE_THEME_DESCRIPTION[card.reflectionTone]) ||
    card.themeDescription;
  return {
    title: base.title,
    description: toneDesc ?? base.description,
  };
}

function deriveActivities(card: DailyMirrorCardModel): PosterActivityRow[] {
  const rows: PosterActivityRow[] = [];
  if (card.userLine.trim()) {
    rows.push({ label: 'Sen', value: truncate(card.userLine, POSTER_RELATION_LINE_MAX) });
  }
  if (card.aiLine.trim()) {
    rows.push({ label: 'AI', value: truncate(card.aiLine, POSTER_RELATION_LINE_MAX) });
  }
  if (card.balanceLine.trim()) {
    rows.push({ label: 'Denge', value: truncate(card.balanceLine, POSTER_RELATION_LINE_MAX) });
  }
  if (rows.length === 0) {
    rows.push({
      label: 'Bugün',
      value: truncate(
        card.mirrorStory || card.shortInsight || card.headline,
        POSTER_RELATION_LINE_MAX
      ),
    });
  }
  return rows.slice(0, 3);
}

function deriveRelationshipBars(card: DailyMirrorCardModel): PosterRelationshipBar[] {
  const base = card.energyScore ?? 55;
  const spread = (card.personaFamilyId.length % 3) * 8;
  return [
    { label: 'Keşfetme', percent: Math.min(95, Math.max(35, base - 5 + spread)) },
    { label: 'Derinleşme', percent: Math.min(95, Math.max(30, base + spread)) },
    { label: 'Uygulama', percent: Math.min(90, Math.max(25, base - 15 + spread)) },
  ];
}

export function buildPosterCardContent(card: DailyMirrorCardModel): PosterCardContent {
  const slot = FAMILY_ASSET_SLOTS[card.personaFamilyId];
  const theme = deriveTheme(card);
  const seed = card.visual?.seedHint ?? card.date ?? card.characterName;

  const storyRaw =
    card.mirrorStory?.trim() ||
    card.shortInsight?.trim() ||
    card.headline?.trim() ||
    'Bugün AI ile geçirdiğin günün sakin bir yansıması.';

  return {
    characterEmoji: slot?.iconFallback ?? '✨',
    characterGradient:
      CHARACTER_NAME_GRADIENT[slot?.colorToken ?? 'violet'] ??
      CHARACTER_NAME_GRADIENT.violet,
    journeyHeadline:
      card.dailyJourney?.trim() || card.headline?.trim() || card.characterName || 'Bugün',
    themeTitle: theme.title,
    themeDescription: truncate(theme.description, POSTER_THEME_DESC_MAX),
    quote: truncate(
      card.quote?.trim() || hashPick(`${seed}-quote`, QUOTE_FALLBACKS),
      POSTER_QUOTE_MAX
    ),
    storyLine: truncate(storyRaw, POSTER_STORY_MAX),
    activities: deriveActivities(card),
    energyDisplay: card.energyLabel || 'Dengede',
    energyPercent: card.energyScore ?? 62,
    relationshipBars: deriveRelationshipBars(card),
  };
}
