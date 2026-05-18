/**
 * EZA İlişki Haritası — frontend agregasyon (mevcut behavioral history).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  classifyAiFromEntries,
  classifyDayFromEntries,
  USER_CATEGORY_LABEL,
  type AiBehaviorCategoryId,
  type UserObservationCategoryId,
} from '@/lib/eza/dailyObservation';
import {
  mapBackendAiCategory,
  mapBackendUserCategory,
  parseStandaloneObservation,
} from '@/lib/standaloneObservation';

export type RelationshipPeriodDays = 7 | 30 | 90;

export interface BehaviorIsland {
  id: string;
  label: string;
  percent: number;
  color: string;
  trend?: 'growing' | 'stable' | 'fading';
  description: string;
  /** 0–1 göreli yoğunluk (ada boyutu için) */
  intensity: number;
}

export interface AiBehaviorTone {
  label: string;
  /** 0–1 göreli yoğunluk (ince bar için) */
  intensity: number;
}

export interface BalancePill {
  label: string;
  active: boolean;
}

export interface RhythmPoint {
  label: string;
  value: number;
}

export interface RelationshipMapViewModel {
  periodDays: RelationshipPeriodDays;
  totalInteractions: number;
  generalBalanceLabel: string;
  generalBalanceHint: string;
  islands: BehaviorIsland[];
  aiBehaviorBars: { label: string; percent: number }[];
  aiBehaviorTones: AiBehaviorTone[];
  balanceBars: { label: string; percent: number }[];
  balanceSummary: string;
  balancePills: BalancePill[];
  editorialNote: string;
  shortNote: string;
  rhythmTimeline: RhythmPoint[];
  avgDepthScore: number | null;
}

const ISLAND_COLORS: Partial<Record<UserObservationCategoryId, string>> = {
  exploration: '#a78bfa',
  decision_support: '#60a5fa',
  clarity_seek: '#34d399',
  creative_ideas: '#fbbf24',
  intellectual_depth: '#818cf8',
  explanation_seek: '#fb923c',
  sensitive_signals: '#f97316',
  safe_balance: '#2dd4bf',
  flow_harmony: '#4ade80',
  balanced: '#94a3b8',
  quiet: '#cbd5e1',
  question_clarity: '#38bdf8',
};

const AI_LABEL: Record<AiBehaviorCategoryId, string> = {
  explanatory: 'Açıklayıcı',
  safe_boundary: 'Güvenli sınır',
  low_redirect: 'Düşük yönlendirme',
  suggestion_density: 'Öneri yoğunluğu',
  balanced_refusal: 'Dengeli sınır',
  high_alignment: 'Uyumlu',
  neutral_tone: 'Nötr / sakin',
  sensitive_balance: 'Hassas denge',
};

const BALANCE_LABELS = [
  'Uyumlu akış',
  'Karar dengesi',
  'Netlik dengesi',
  'Keşif dengesi',
  'Güvenli denge',
  'Sakin ritim',
];

const ISLAND_DESCRIPTIONS: Record<UserObservationCategoryId, string> = {
  balanced: 'Konuşmalar genel olarak ölçülü ve dengeli bir ritimde ilerlemiş.',
  decision_support: 'Yön bulma ve seçenek tartma konuşmaları öne çıkıyor.',
  clarity_seek: 'Netlik ve sadeleştirme arayışı daha belirgin görünüyor.',
  flow_harmony: 'Soru ve yanıt akışı uyumlu bir çizgide seyretmiş.',
  sensitive_signals: 'Hassas konulara dair dikkatli bir ton öne çıkmış.',
  safe_balance: 'Hassas sinyallere rağmen denge sakin kalmış.',
  question_clarity: 'Soruların yapısı netleşme eğilimi taşımış.',
  exploration: 'Keşif ve yeni ihtimaller konuşmalarda öne çıkıyor.',
  creative_ideas: 'Fikir geliştirme ve üretken konuşmalar belirginleşmiş.',
  intellectual_depth: 'Derin düşünme ve bağlam arayışı öne çıkıyor.',
  explanation_seek: 'Açıklama ve gerekçe arayışı daha sık görülmüş.',
  quiet: 'Sakin ve sade bir konuşma ritmi hakim olmuş.',
};

const TREND_LABEL: Record<NonNullable<BehaviorIsland['trend']>, string> = {
  growing: 'Artan eğilim',
  stable: 'Sakin ritim',
  fading: 'Hafif soluk',
};

function categoryForEntry(e: SavedBehavioralEntry): UserObservationCategoryId {
  const obs = parseStandaloneObservation(e.standaloneObservation);
  if (obs) return mapBackendUserCategory(obs.user_pattern.category);
  return classifyDayFromEntries([e]);
}

function islandTrend(
  entries: SavedBehavioralEntry[],
  categoryId: UserObservationCategoryId
): BehaviorIsland['trend'] {
  if (entries.length < 4) return 'stable';
  const sorted = [...entries].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );
  const mid = Math.max(1, Math.floor(sorted.length / 2));
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);
  const rate = (chunk: SavedBehavioralEntry[]) => {
    if (!chunk.length) return 0;
    const hits = chunk.filter((e) => categoryForEntry(e) === categoryId).length;
    return hits / chunk.length;
  };
  const r1 = rate(first);
  const r2 = rate(second);
  if (r2 > r1 * 1.2 + 0.05) return 'growing';
  if (r2 < r1 * 0.8 - 0.05) return 'fading';
  return 'stable';
}

function buildRhythmTimeline(entries: SavedBehavioralEntry[]): RhythmPoint[] {
  const buckets = new Map<number, { label: string; count: number }>();
  for (const e of entries) {
    const d = new Date(e.savedAt);
    if (Number.isNaN(d.getTime())) continue;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const existing = buckets.get(dayStart);
    if (existing) existing.count += 1;
    else buckets.set(dayStart, { label, count: 1 });
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-12)
    .map(([, v]) => ({ label: v.label, value: v.count }));
}

function buildEditorialNote(
  periodDays: number,
  islands: BehaviorIsland[],
  aiTones: AiBehaviorTone[],
  generalBalanceHint: string
): string {
  const dominant = islands[0];
  const topAi = aiTones[0];
  if (!dominant) {
    return 'Konuşma biçimine dair desenler henüz netleşmedi; birkaç etkileşim daha sonra burada daha okunur bir özet belirecek.';
  }
  const aiPart = topAi
    ? `AI yanıtları çoğunlukla ${topAi.label.toLowerCase()} bir çizgide kalmış.`
    : 'AI yanıt tonu genel olarak dengeli seyretmiş.';
  const trendPart =
    dominant.trend === 'growing'
      ? `${dominant.label} eğilimi son dönemde daha belirgin görünüyor.`
      : `${dominant.label.toLowerCase()} konuşma biçiminde öne çıkan bir desen.`;
  return `Son ${periodDays} günde ${trendPart} ${aiPart} ${generalBalanceHint}`;
}

function buildBalanceSummary(
  generalBalanceLabel: string,
  generalBalanceHint: string
): string {
  return `Etkileşimlerin çoğu ${generalBalanceLabel.toLowerCase()} bir ritimde ilerlemiş. ${generalBalanceHint}`;
}

function buildBalancePills(
  islands: BehaviorIsland[],
  aiTones: AiBehaviorTone[]
): BalancePill[] {
  const dominant = islands[0]?.label?.toLowerCase() ?? '';
  const topAi = aiTones[0]?.label?.toLowerCase() ?? '';
  return [
    {
      label: 'Uyumlu Akış',
      active: dominant.includes('akış') || dominant.includes('dengeli') || topAi.includes('uyum'),
    },
    {
      label: 'Açıklama Dengesi',
      active: topAi.includes('açıkla') || dominant.includes('açıklama'),
    },
    {
      label: 'Karar Dengesi',
      active: dominant.includes('karar') || dominant.includes('yön'),
    },
  ];
}

function filterByPeriod(
  entries: SavedBehavioralEntry[],
  days: RelationshipPeriodDays
): SavedBehavioralEntry[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((e) => new Date(e.savedAt).getTime() >= cutoff);
}

function countCategories(entries: SavedBehavioralEntry[]): Map<UserObservationCategoryId, number> {
  const counts = new Map<UserObservationCategoryId, number>();
  const hasBackend = entries.some(
    (e) => parseStandaloneObservation(e.standaloneObservation) !== null
  );

  if (hasBackend) {
    for (const e of entries) {
      const obs = parseStandaloneObservation(e.standaloneObservation);
      if (!obs) continue;
      const cat = mapBackendUserCategory(obs.user_pattern.category);
      const weight = Math.max(1, Math.round((obs.user_pattern.confidence || 0.5) * 2));
      counts.set(cat, (counts.get(cat) ?? 0) + weight);
    }
    return counts;
  }

  for (const e of entries) {
    const cat = classifyDayFromEntries([e]);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return counts;
}

function countAi(entries: SavedBehavioralEntry[]): Map<AiBehaviorCategoryId, number> {
  const counts = new Map<AiBehaviorCategoryId, number>();
  const hasBackend = entries.some(
    (e) => parseStandaloneObservation(e.standaloneObservation) !== null
  );

  if (hasBackend) {
    for (const e of entries) {
      const obs = parseStandaloneObservation(e.standaloneObservation);
      if (!obs) continue;
      const cat = mapBackendAiCategory(obs.ai_behavior.category);
      const weight = Math.max(1, Math.round((obs.ai_behavior.confidence || 0.5) * 2));
      counts.set(cat, (counts.get(cat) ?? 0) + weight);
    }
    return counts;
  }

  for (const e of entries) {
    const cat = classifyAiFromEntries([e]);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return counts;
}

function toPercentBars<T extends string>(
  counts: Map<T, number>,
  total: number,
  labels: Partial<Record<T, string>>
): { label: string; percent: number }[] {
  if (total === 0) return [];
  return Array.from(counts.entries())
    .map(([id, n]) => ({
      label: labels[id] ?? String(id),
      percent: Math.round((n / total) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);
}

export function buildRelationshipMap(
  entries: SavedBehavioralEntry[],
  periodDays: RelationshipPeriodDays = 30
): RelationshipMapViewModel {
  const filtered = filterByPeriod(entries, periodDays);
  const total = filtered.length;

  if (total === 0) {
    return {
      periodDays,
      totalInteractions: 0,
      generalBalanceLabel: 'Henüz veri yok',
      generalBalanceHint: 'Birkaç sohbetten sonra harita burada şekillenir.',
      islands: [],
      aiBehaviorBars: [],
      aiBehaviorTones: [],
      balanceBars: [],
      balanceSummary:
        'Henüz yeterli etkileşim birikmedi; harita birkaç sohbetten sonra şekillenecek.',
      balancePills: [
        { label: 'Uyumlu Akış', active: false },
        { label: 'Açıklama Dengesi', active: false },
        { label: 'Karar Dengesi', active: false },
      ],
      editorialNote:
        'Konuşma yolculuğunun haritası için henüz yeterli iz yok. Sakin bir başlangıçtan sonra desenler burada belirecek.',
      shortNote:
        'EZA, konuşma biçiminden gözlemsel desenler çıkarır; henüz yeterli etkileşim birikmedi.',
      rhythmTimeline: [],
      avgDepthScore: null,
    };
  }

  const userCounts = countCategories(filtered);
  const maxCount = Math.max(...Array.from(userCounts.values()), 1);
  const islands: BehaviorIsland[] = Array.from(userCounts.entries())
    .map(([cat, n]) => {
      const percent = Math.round((n / total) * 100);
      const trend = islandTrend(filtered, cat);
      return {
        id: cat,
        label: USER_CATEGORY_LABEL[cat],
        percent,
        color: ISLAND_COLORS[cat] ?? '#94a3b8',
        trend,
        description: ISLAND_DESCRIPTIONS[cat],
        intensity: Math.max(0.35, Math.min(1, n / maxCount)),
      };
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  const aiCounts = countAi(filtered);
  const aiBehaviorBars = toPercentBars(aiCounts, total, AI_LABEL);
  const maxAi = aiBehaviorBars[0]?.percent ?? 100;
  const aiBehaviorTones: AiBehaviorTone[] = aiBehaviorBars.slice(0, 5).map((bar) => ({
    label: bar.label,
    intensity: Math.max(0.25, bar.percent / Math.max(maxAi, 1)),
  }));

  const balanceBars = islands.slice(0, 5).map((island) => ({
    label: island.label,
    percent: island.percent,
  }));

  const dominant = islands[0];
  const sensitiveShare =
    ((userCounts.get('sensitive_signals') ?? 0) + (userCounts.get('safe_balance') ?? 0)) / total;

  let generalBalanceLabel = 'Dengeli ve güvenli';
  let generalBalanceHint = 'Etkileşimler genel olarak ölçülü bir çizgide.';
  if (sensitiveShare > 0.25) {
    generalBalanceLabel = 'Dikkatli ama dengeli';
    generalBalanceHint = 'Hassas sinyaller görüldü; denge korunmuş görünüyor.';
  } else if (dominant?.id === 'exploration' || dominant?.id === 'creative_ideas') {
    generalBalanceLabel = 'Keşif odaklı akış';
    generalBalanceHint = 'Yeni fikirler ve ihtimaller öne çıkıyor.';
  } else if (dominant?.id === 'decision_support') {
    generalBalanceLabel = 'Karar desteği ağırlıklı';
    generalBalanceHint = 'Yön ve netlik arayışı belirgin.';
  }

  const alignScores = filtered
    .map((e) => e.vector.alignment_score)
    .filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  const avgAlign =
    alignScores.length > 0
      ? alignScores.reduce((a, b) => a + (b <= 1 ? b * 100 : b), 0) / alignScores.length
      : null;
  const avgDepthScore =
    avgAlign !== null ? Math.round((avgAlign / 100) * 10 * 10) / 10 : null;

  const balanceSummary = buildBalanceSummary(generalBalanceLabel, generalBalanceHint);
  const balancePills = buildBalancePills(islands, aiBehaviorTones);
  const editorialNote = buildEditorialNote(
    periodDays,
    islands,
    aiBehaviorTones,
    generalBalanceHint
  );
  const shortNote = editorialNote;
  const rhythmTimeline = buildRhythmTimeline(filtered);

  return {
    periodDays,
    totalInteractions: total,
    generalBalanceLabel,
    generalBalanceHint,
    islands,
    aiBehaviorBars,
    aiBehaviorTones,
    balanceBars: balanceBars.length ? balanceBars : BALANCE_LABELS.map((label, i) => ({
      label,
      percent: Math.max(8, 28 - i * 4),
    })),
    balanceSummary,
    balancePills,
    editorialNote,
    shortNote,
    rhythmTimeline,
    avgDepthScore,
  };
}

export { TREND_LABEL };
