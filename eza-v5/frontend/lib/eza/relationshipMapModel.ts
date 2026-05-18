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
}

export interface RelationshipMapViewModel {
  periodDays: RelationshipPeriodDays;
  totalInteractions: number;
  generalBalanceLabel: string;
  generalBalanceHint: string;
  islands: BehaviorIsland[];
  aiBehaviorBars: { label: string; percent: number }[];
  balanceBars: { label: string; percent: number }[];
  shortNote: string;
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
      balanceBars: [],
      shortNote:
        'EZA, konuşma biçiminden gözlemsel desenler çıkarır; henüz yeterli etkileşim birikmedi.',
      avgDepthScore: null,
    };
  }

  const userCounts = countCategories(filtered);
  const islands: BehaviorIsland[] = Array.from(userCounts.entries())
    .map(([cat, n]) => ({
      id: cat,
      label: USER_CATEGORY_LABEL[cat],
      percent: Math.round((n / total) * 100),
      color: ISLAND_COLORS[cat] ?? '#94a3b8',
      trend: 'stable' as const,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  const aiCounts = countAi(filtered);
  const aiBehaviorBars = toPercentBars(aiCounts, total, AI_LABEL);

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

  const shortNote = dominant
    ? `Son ${periodDays} günde en sık görülen desen: ${dominant.label.toLowerCase()} (%${dominant.percent}). Bu bir kişilik tanımı değil; konuşma biçimine dair gözlemsel bir özet.`
    : 'Etkileşim desenin henüz netleşmedi.';

  return {
    periodDays,
    totalInteractions: total,
    generalBalanceLabel,
    generalBalanceHint,
    islands,
    aiBehaviorBars,
    balanceBars: balanceBars.length ? balanceBars : BALANCE_LABELS.map((label, i) => ({
      label,
      percent: Math.max(8, 28 - i * 4),
    })),
    shortNote,
    avgDepthScore,
  };
}
