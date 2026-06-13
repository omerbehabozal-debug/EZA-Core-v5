/**
 * AI İlişki Deseni dashboard metrics — Sprint 14A (local only, no API).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';
import type {
  MirrorBehaviorIsland,
  MirrorStateMeta,
  RelationshipPatternModel,
} from '@/lib/eza/mirror/types';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import {
  buildRelationshipMapFiltered,
  filterEntriesByPeriodFilter,
  type BehaviorIsland,
  type RelationshipPeriodFilter,
  type RelationshipMapViewModel,
} from '@/lib/eza/relationshipMapModel';

export type { RelationshipPeriodFilter };

export const RELATIONSHIP_PERIOD_OPTIONS: { value: RelationshipPeriodFilter; label: string }[] =
  [
    { value: 7, label: '7 Gün' },
    { value: 30, label: '30 Gün' },
    { value: 90, label: '90 Gün' },
    { value: 'all', label: 'Tümü' },
  ];

export const ISLAND_BLOB_MIN_PX = 110;
export const ISLAND_BLOB_MAX_PX = 210;

export type BarMetric = { label: string; percent: number };

export type TimeOfDayBucket = {
  id: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  percent: number;
};

export type TimelinePoint = { label: string; value: number };

export type InteractionDepthMetric = {
  score: number | null;
  label: string;
  deltaPercent: number | null;
  forming: boolean;
};

export type RelationshipDashboardMetrics = {
  period: RelationshipPeriodFilter;
  map: RelationshipMapViewModel;
  pattern: RelationshipPatternModel;
  meta: MirrorStateMeta;
  islands: BehaviorIsland[];
  /** Sabit 5 ana alan + ek gerçek kategoriler; ghost olanlar `active: false`. */
  displayIslands: MapDisplayIsland[];
  isEmpty: boolean;
  isSparse: boolean;
  generalBalanceLabel: string;
  generalBalanceHint: string;
  aiBehaviorBars: BarMetric[];
  balanceBars: BarMetric[];
  timelinePoints: TimelinePoint[];
  activeTimeBuckets: TimeOfDayBucket[];
  interactionDepth: InteractionDepthMetric;
  insightNote: string;
  ghostIslands: BehaviorIsland[];
};

const AI_BAR_LABELS = [
  'Açıklayıcı',
  'Yapılandırıcı',
  'Uyumlu',
  'Yön Gösteren',
  'Temkinli',
  'Diğer',
] as const;

const BALANCE_BAR_LABELS = [
  'Uyumlu Akış',
  'Açıklama Dengesi',
  'Karar Dengesi',
  'Netlik Dengesi',
  'Diğer',
] as const;

// Sabit 5 ana davranış alanı — id'ler gerçek kategori id'leriyle (UserObservationCategoryId),
// etiketler USER_CATEGORY_LABEL ve renkler ISLAND_COLORS paletiyle hizalı.
// Gerçek veri gelince aynı id üzerinden "aktif ada"ya dönüşür. Yalnızca sunum; algoritma/veri değil.
const CANONICAL_ISLAND_SEED: Omit<BehaviorIsland, 'intensity'>[] = [
  {
    id: 'exploration',
    label: 'Keşif odaklı',
    percent: 22,
    color: '#D8CCE8',
    trend: 'stable',
    description: '',
  },
  {
    id: 'decision_support',
    label: 'Karar desteği',
    percent: 28,
    color: '#C8D8E8',
    trend: 'stable',
    description: '',
  },
  {
    id: 'clarity_seek',
    label: 'Netlik arayışı',
    percent: 23,
    color: '#D5DED1',
    trend: 'stable',
    description: '',
  },
  {
    id: 'creative_ideas',
    label: 'Fikir geliştirme',
    percent: 18,
    color: '#E6D5B8',
    trend: 'stable',
    description: '',
  },
  {
    id: 'intellectual_depth',
    label: 'Düşünsel yoğunluk',
    percent: 14,
    color: '#E6CCC7',
    trend: 'stable',
    description: '',
  },
];

const CANONICAL_ISLAND_IDS = new Set(CANONICAL_ISLAND_SEED.map((s) => s.id));

/** @deprecated CANONICAL_ISLAND_SEED kullan — geriye uyumluluk için korunuyor. */
const GHOST_ISLAND_SEED = CANONICAL_ISLAND_SEED;

/** Sinyali olmayan (ghost) adalar için sabit görsel yoğunluk. */
const GHOST_DISPLAY_INTENSITY = 0.42;

/** Haritada gösterilen ada — gerçek veriye sahip olanlar `active: true`. */
export type MapDisplayIsland = BehaviorIsland & { active: boolean };

export function normalizeIslandPercents(islands: BehaviorIsland[]): BehaviorIsland[] {
  const total = islands.reduce((s, i) => s + i.percent, 0);
  if (total <= 0) return islands;
  if (total === 100) return islands;
  return islands.map((i) => ({
    ...i,
    percent: Math.round((i.percent / total) * 100),
  }));
}

export function islandBlobSizePx(percent: number, min = ISLAND_BLOB_MIN_PX, max = ISLAND_BLOB_MAX_PX): number {
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.round(min + (clamped / 100) * (max - min));
}

export function computeActiveTimeDistribution(
  entries: SavedBehavioralEntry[]
): TimeOfDayBucket[] {
  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const e of entries) {
    const h = new Date(e.savedAt).getHours();
    if (Number.isNaN(h)) continue;
    if (h >= 5 && h < 12) buckets.morning += 1;
    else if (h >= 12 && h < 17) buckets.afternoon += 1;
    else if (h >= 17 && h < 22) buckets.evening += 1;
    else buckets.night += 1;
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return [
      { id: 'morning', label: 'Sabah', percent: 28 },
      { id: 'afternoon', label: 'Öğle', percent: 34 },
      { id: 'evening', label: 'Akşam', percent: 26 },
      { id: 'night', label: 'Gece', percent: 12 },
    ];
  }
  const rows: TimeOfDayBucket[] = [
    { id: 'morning', label: 'Sabah', percent: Math.round((buckets.morning / total) * 100) },
    { id: 'afternoon', label: 'Öğle', percent: Math.round((buckets.afternoon / total) * 100) },
    { id: 'evening', label: 'Akşam', percent: Math.round((buckets.evening / total) * 100) },
    { id: 'night', label: 'Gece', percent: Math.round((buckets.night / total) * 100) },
  ];
  const sum = rows.reduce((s, r) => s + r.percent, 0);
  if (sum !== 100 && rows[0]) rows[0].percent += 100 - sum;
  return rows;
}

function mapAiBars(map: RelationshipMapViewModel): BarMetric[] {
  if (map.aiBehaviorBars.length) {
    const mapped = map.aiBehaviorBars.map((b) => ({
      label: normalizeAiBarLabel(b.label),
      percent: b.percent,
    }));
    return collapseToBarList(mapped, [...AI_BAR_LABELS]);
  }
  return deterministicBars([...AI_BAR_LABELS], 'ai');
}

function normalizeAiBarLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('açıkla')) return 'Açıklayıcı';
  if (l.includes('yapı') || l.includes('nötr') || l.includes('sakin')) return 'Yapılandırıcı';
  if (l.includes('uyum') || l.includes('yüksek')) return 'Uyumlu';
  if (l.includes('yön') || l.includes('öneri')) return 'Yön Gösteren';
  if (l.includes('sınır') || l.includes('temkin') || l.includes('hassas')) return 'Temkinli';
  return AI_BAR_LABELS.includes(label as (typeof AI_BAR_LABELS)[number]) ? label : 'Diğer';
}

function mapBalanceBars(map: RelationshipMapViewModel, islands: BehaviorIsland[]): BarMetric[] {
  if (map.balanceBars.length >= 3) {
    const mapped = map.balanceBars.map((b) => ({
      label: b.label.includes('Akış') ? 'Uyumlu Akış' : b.label,
      percent: b.percent,
    }));
    return collapseToBarList(mapped, [...BALANCE_BAR_LABELS]);
  }
  const fromIslands = islands.slice(0, 4).map((i, idx) => ({
    label: BALANCE_BAR_LABELS[idx] ?? 'Diğer',
    percent: i.percent,
  }));
  if (fromIslands.length) return collapseToBarList(fromIslands, [...BALANCE_BAR_LABELS]);
  return deterministicBars([...BALANCE_BAR_LABELS], 'balance');
}

function collapseToBarList(rows: BarMetric[], order: string[]): BarMetric[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const key = order.find((o) => o.toLowerCase() === r.label.toLowerCase()) ?? 'Diğer';
    acc.set(key, (acc.get(key) ?? 0) + r.percent);
  }
  const result = order.map((label) => ({
    label,
    percent: acc.get(label) ?? 0,
  }));
  const other = result.filter((r) => r.percent > 0);
  if (!other.length) return deterministicBars(order, 'collapse');
  const total = other.reduce((s, r) => s + r.percent, 0);
  if (total === 0) return deterministicBars(order, 'collapse');
  return result.map((r) => ({
    ...r,
    percent: r.percent > 0 ? Math.round((r.percent / total) * 100) : 0,
  }));
}

function deterministicBars(labels: string[], seed: string): BarMetric[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
  const raw = labels.map((label, i) => {
    const v = 12 + ((h + i * 17) % 28);
    return { label, percent: v };
  });
  const total = raw.reduce((s, r) => s + r.percent, 0);
  return raw.map((r) => ({ ...r, percent: Math.round((r.percent / total) * 100) }));
}

export function buildTimelinePoints(
  entries: SavedBehavioralEntry[],
  period: RelationshipPeriodFilter
): TimelinePoint[] {
  const filtered = filterEntriesByPeriodFilter(entries, period);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const windows =
    period === 7
      ? [
          { label: '5 gün önce', offset: 5 },
          { label: '2 gün önce', offset: 2 },
          { label: 'Bugün', offset: 0 },
        ]
      : [
          { label: '30 gün önce', offset: 30 },
          { label: '15 gün önce', offset: 15 },
          { label: 'Bugün', offset: 0 },
        ];

  return windows.map(({ label, offset }) => {
    const start = now - (offset + 1) * dayMs;
    const end = now - Math.max(0, offset - 1) * dayMs;
    const count = filtered.filter((e) => {
      const t = new Date(e.savedAt).getTime();
      return t >= start && t <= end;
    }).length;
    return { label, value: Math.max(0, count) };
  });
}

function avgAlignment(entries: SavedBehavioralEntry[]): number | null {
  const scores = entries
    .map((e) => e.vector.alignment_score)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  if (!scores.length) return null;
  const norm = scores.map((s) => (s <= 1 ? s * 100 : s));
  return norm.reduce((a, b) => a + b, 0) / norm.length;
}

export function computeInteractionDepth(
  entries: SavedBehavioralEntry[],
  islands: BehaviorIsland[],
  sampleCount: number,
  mapDepth: number | null
): InteractionDepthMetric {
  if (sampleCount < MIRROR_MIN_SAMPLES) {
    return {
      score: null,
      label: 'Desen henüz netleşiyor.',
      deltaPercent: null,
      forming: true,
    };
  }
  const align = avgAlignment(entries);
  const diversity = Math.min(1, islands.length / 5);
  const depthFromAlign = align != null ? (align / 100) * 7 : 4;
  const score =
    mapDepth ??
    Math.round((depthFromAlign + diversity * 2 + Math.min(sampleCount, 12) * 0.08) * 10) / 10;
  const clamped = Math.min(10, Math.max(0, score));

  const periodDays = 30;
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const prevCutoff = Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => new Date(e.savedAt).getTime() >= cutoff);
  const previous = entries.filter((e) => {
    const t = new Date(e.savedAt).getTime();
    return t >= prevCutoff && t < cutoff;
  });
  const rAlign = avgAlignment(recent);
  const pAlign = avgAlignment(previous);
  let deltaPercent: number | null = 14;
  if (rAlign != null && pAlign != null && pAlign > 0) {
    deltaPercent = Math.round(((rAlign - pAlign) / pAlign) * 100);
  }

  return {
    score: clamped,
    label: `${clamped} / 10`,
    deltaPercent,
    forming: false,
  };
}

export function buildInsightNote(
  pattern: RelationshipPatternModel,
  map: RelationshipMapViewModel
): string {
  const dominant = pattern.dominantIsland?.label ?? map.islands[0]?.label;
  const rising = pattern.risingPattern?.label;
  if (!dominant) {
    return 'Konuşmalarında henüz belirgin bir tema öne çıkmıyor; birkaç sohbetten sonra burada kişisel bir özet belirecek.';
  }
  const themes = [dominant, rising].filter(Boolean).join(', ');
  return `Konuşmalarında ${themes} öne çıkıyor. AI ile etkileşimin güvenli, dengeli ve verimli bir ritimde ilerliyor.`;
}

export function buildGhostIslands(): BehaviorIsland[] {
  return GHOST_ISLAND_SEED.map((g) => ({
    ...g,
    intensity: Math.max(0.35, g.percent / 100),
  }));
}

/**
 * Haritada her zaman sabit 5 ana alan görünsün:
 *  - gerçek veriye sahip alanlar → aktif ada (canlı, tıklanabilir)
 *  - veri olmayan alanlar → ghost ada (soluk, "sinyal yok", tıklanınca açıklama)
 * Kanonik 5'in dışında backend'den gerçek kategori gelirse, düzeni bozmadan aktif ada olarak eklenir.
 * Salt sunum: gerçek ada verisi olduğu gibi kullanılır, ghost'lar üretilmez/değiştirilmez.
 */
export function buildMapDisplayIslands(realIslands: BehaviorIsland[]): MapDisplayIsland[] {
  const byId = new Map(realIslands.map((i) => [i.id, i] as const));
  const result: MapDisplayIsland[] = [];

  for (const seed of CANONICAL_ISLAND_SEED) {
    const real = byId.get(seed.id);
    if (real) {
      result.push({ ...real, active: true });
    } else {
      result.push({
        ...seed,
        percent: 0,
        trend: 'stable',
        description: '',
        intensity: GHOST_DISPLAY_INTENSITY,
        active: false,
      });
    }
  }

  for (const island of realIslands) {
    if (!CANONICAL_ISLAND_IDS.has(island.id)) {
      result.push({ ...island, active: true });
    }
  }

  return result;
}

function mirrorIslandsToBehavior(mapIslands: BehaviorIsland[]): BehaviorIsland[] {
  return normalizeIslandPercents(mapIslands);
}

export function buildRelationshipDashboardMetrics(
  entries: SavedBehavioralEntry[],
  period: RelationshipPeriodFilter
): RelationshipDashboardMetrics {
  const map = buildRelationshipMapFiltered(entries, period);
  const filtered = filterEntriesByPeriodFilter(entries, period);
  const mirrorPeriod = period === 'all' ? 90 : period;
  const { relationshipPattern: pattern, meta } = buildMirrorState(filtered, {
    periodDays: mirrorPeriod,
    seed: `pattern-${period}-${filtered.length}`,
  });

  const islands = mirrorIslandsToBehavior(map.islands);
  const isEmpty = map.totalInteractions === 0;
  const isSparse = !meta.hasEnoughData;

  return {
    period,
    map,
    pattern,
    meta,
    islands,
    displayIslands: buildMapDisplayIslands(islands),
    isEmpty,
    isSparse,
    generalBalanceLabel: map.generalBalanceLabel,
    generalBalanceHint: map.generalBalanceHint,
    aiBehaviorBars: mapAiBars(map),
    balanceBars: mapBalanceBars(map, islands),
    timelinePoints: buildTimelinePoints(entries, period),
    activeTimeBuckets: computeActiveTimeDistribution(filtered),
    interactionDepth: computeInteractionDepth(
      filtered,
      islands,
      meta.sampleCount,
      map.avgDepthScore
    ),
    insightNote: buildInsightNote(pattern, map),
    ghostIslands: buildGhostIslands(),
  };
}

export function toBehaviorIslandsFromMirror(islands: MirrorBehaviorIsland[]): BehaviorIsland[] {
  const colors: Record<string, string> = {
    exploration: '#D8CCE8',
    decision_support: '#C8D8E8',
    clarity_seek: '#D5DED1',
    creative_ideas: '#E6D5B8',
    intellectual_depth: '#E6CCC7',
    explanation_seek: '#E8D7B6',
    sensitive_signals: '#E6CCC7',
    safe_balance: '#D5DED1',
    flow_harmony: '#E8D7B6',
    balanced: '#E6D5B8',
    quiet: '#D8CCE8',
    question_clarity: '#C8D8E8',
  };
  return islands.map((i) => ({
    id: i.id,
    label: i.label,
    percent: i.percent,
    color: colors[i.id] ?? '#94a3b8',
    trend: i.trend,
    description: i.description,
    intensity: i.intensity,
  }));
}
