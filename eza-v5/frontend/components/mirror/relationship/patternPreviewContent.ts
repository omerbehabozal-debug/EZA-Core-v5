/**
 * Relationship Pattern — Free plan statik önizleme içeriği (yalnızca UX).
 * Gerçek veri gibi görünmemeli; sabit, silik placeholder.
 */

import type {
  BarMetric,
  InteractionDepthMetric,
  TimelinePoint,
  TimeOfDayBucket,
} from '@/lib/eza/mirror/relationshipPatternMetrics';

export const PATTERN_PREVIEW_TIMELINE: TimelinePoint[] = [
  { label: '·', value: 38 },
  { label: '·', value: 52 },
  { label: '·', value: 44 },
];

export const PATTERN_PREVIEW_BALANCE_BARS: BarMetric[] = [
  { label: 'Alan 1', percent: 42 },
  { label: 'Alan 2', percent: 42 },
  { label: 'Alan 3', percent: 42 },
  { label: 'Alan 4', percent: 42 },
];

export const PATTERN_PREVIEW_AI_BARS: BarMetric[] = [
  { label: 'Ton 1', percent: 40 },
  { label: 'Ton 2', percent: 40 },
  { label: 'Ton 3', percent: 40 },
  { label: 'Ton 4', percent: 40 },
];

export const PATTERN_PREVIEW_TIME_BUCKETS: TimeOfDayBucket[] = [
  { id: 'morning', label: 'Sabah', percent: 25 },
  { id: 'afternoon', label: 'Öğle', percent: 25 },
  { id: 'evening', label: 'Akşam', percent: 25 },
  { id: 'night', label: 'Gece', percent: 25 },
];

export const PATTERN_PREVIEW_DEPTH: InteractionDepthMetric = {
  score: null,
  label: 'Plus ile oluşur',
  deltaPercent: null,
  forming: true,
};

export const PATTERN_PREVIEW_INSIGHT =
  'Plus ile sohbetlerinden kişisel içgörüler ve davranış desenlerin burada belirir.';

export const PATTERN_PREVIEW_BALANCE_LABEL = 'Plus ile canlanır';

export const PATTERN_PREVIEW_BALANCE_HINT =
  'Gerçek denge özeti, Plus ile sohbetlerinden oluşur.';

export const PATTERN_PREVIEW_SECTION_NOTE =
  'Bu alanlar Plus ile sohbetlerinden canlanır.';
