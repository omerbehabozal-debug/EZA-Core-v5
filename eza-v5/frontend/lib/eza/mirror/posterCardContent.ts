/**
 * Daily Mirror Poster — UI-only content derivation (no backend changes).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS } from '@/lib/eza/personaAssets';

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
  themeTitle: string;
  themeDescription: string;
  quote: string;
  description: string;
  activities: PosterActivityRow[];
  energyDisplay: string;
  energyPercent: number;
  relationshipBars: PosterRelationshipBar[];
  relationshipNote: string;
  tomorrowHint: string;
};

const QUOTE_FALLBACKS = [
  'Anlamak, haklı olmaktan daha güçlüdür.',
  'Yavaşlamak, yönünü netleştirmektir.',
  'Küçük bir adım, yarının dengesini kurar.',
  'Gerçek dostluk, farklı fikirlerle bile birbirini seçmektir.',
  'Kendine iyi baktığın her an, gelecekteki sana bir iyiliktir.',
];

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
  if (topic && THEME_FROM_TOPIC[topic]) {
    return THEME_FROM_TOPIC[topic];
  }
  return FAMILY_THEME[card.personaFamilyId] ?? THEME_FROM_TOPIC['genel düşünce']!;
}

function deriveActivities(card: DailyMirrorCardModel): PosterActivityRow[] {
  const rows: PosterActivityRow[] = [];
  if (card.userLine.trim()) {
    rows.push({ label: 'Senin yansıman', value: truncate(card.userLine, 72) });
  }
  if (card.aiLine.trim()) {
    rows.push({ label: 'AI yanıtı', value: truncate(card.aiLine, 72) });
  }
  if (card.balanceLine.trim()) {
    rows.push({ label: 'Denge notu', value: truncate(card.balanceLine, 72) });
  }
  if (rows.length === 0) {
    rows.push({ label: 'Bugün', value: truncate(card.shortInsight || card.headline, 72) });
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

  return {
    characterEmoji: slot?.iconFallback ?? '✨',
    characterGradient:
      CHARACTER_NAME_GRADIENT[slot?.colorToken ?? 'violet'] ??
      CHARACTER_NAME_GRADIENT.violet,
    themeTitle: theme.title,
    themeDescription: theme.description,
    quote: hashPick(seed, QUOTE_FALLBACKS),
    description: truncate(
      card.shortInsight || card.headline || 'Bugünkü etkileşimlerinden kısa bir yansıma.',
      160
    ),
    activities: deriveActivities(card),
    energyDisplay: card.energyLabel || 'Dengede',
    energyPercent: card.energyScore ?? 62,
    relationshipBars: deriveRelationshipBars(card),
    relationshipNote: truncate(
      card.balanceLine || 'İlişkinde küçük adımlar büyük fark yaratabilir.',
      90
    ),
    tomorrowHint:
      'Bugünkü yansıman, yarın atacağın küçük bir adım için ipucu olabilir.',
  };
}
