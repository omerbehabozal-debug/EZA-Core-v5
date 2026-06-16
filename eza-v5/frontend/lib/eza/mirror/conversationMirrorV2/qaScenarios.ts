/**
 * Mirror V2 QA lab — 10 scenario fixtures for manual quality review.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { SainaMirrorSeason } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { buildToothpasteMirrorEntries } from '@/lib/eza/mirror/conversationMirrorV2/toothpasteConversationFixture';

export type MirrorV2QaScore = {
  cinematicImpact?: number;
  lowTextDensity?: number;
  topicRecognition?: number;
  mirrorFeeling?: number;
  shareValue?: number;
  sainaIdentity?: number;
};

export type MirrorV2QaScenario = {
  id: string;
  label: string;
  season?: SainaMirrorSeason;
  buildEntries: () => SavedBehavioralEntry[];
};

function baseVector(score = 82) {
  return {
    input_risk: 0.22,
    output_risk: 0.18,
    input_health: 0.78,
    output_health: 0.82,
    alignment_score: score,
    eza_final: score,
    intent: 'explore',
    alignment_verdict: null,
    redirect: false,
    redirect_reason: null,
    policy_violation_count: 0,
  };
}

function entry(
  id: string,
  savedAt: string,
  hints: string[],
  score = 82
): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt,
    mirrorCueHints: hints,
    vector: baseVector(score),
    asymmetry: {
      health_gap: 0.04,
      risk_delta_output_minus_input: -0.04,
      index: 0.08,
    },
  };
}

function threeTurns(hintsPerTurn: string[][]): SavedBehavioralEntry[] {
  const base = Date.now();
  return hintsPerTurn.map((hints, i) =>
    entry(`qa-${i}`, new Date(base - i * 3600000).toISOString(), hints)
  );
}

export const MIRROR_V2_QA_SCENARIOS: MirrorV2QaScenario[] = [
  {
    id: 'toothpaste-choice',
    label: 'Diş macunu seçimi',
    season: 'bright_cinematic',
    buildEntries: () => buildToothpasteMirrorEntries(),
  },
  {
    id: 'japan-travel',
    label: 'Japonya seyahati',
    season: 'golden_hour',
    buildEntries: () =>
      threeTurns([
        ['japan', 'tokyo', 'travel', 'kyoto'],
        ['culture', 'itinerary', 'trip'],
        ['experience', 'curious', 'explore'],
      ]),
  },
  {
    id: 'bmw-mercedes',
    label: 'BMW vs Mercedes',
    season: 'quiet_luxury',
    buildEntries: () =>
      threeTurns([
        ['bmw', 'mercedes', 'luxury', 'car', 'compare'],
        ['comfort', 'quality', 'decision'],
        ['showroom', 'premium', 'vehicle'],
      ]),
  },
  {
    id: 'architecture-facade',
    label: 'Mimari cephe',
    season: 'editorial_magazine',
    buildEntries: () =>
      threeTurns([
        ['architecture', 'facade', 'building', 'design'],
        ['material', 'proportion', 'light'],
        ['structure', 'urban', 'premium'],
      ]),
  },
  {
    id: 'career-decision',
    label: 'Kariyer kararı',
    season: 'bright_cinematic',
    buildEntries: () =>
      threeTurns([
        ['career', 'startup', 'future', 'decision'],
        ['opportunity', 'uncertain', 'plan'],
        ['threshold', 'hopeful', 'path'],
      ]),
  },
  {
    id: 'ai-trust',
    label: 'Yapay zeka güveni',
    season: 'editorial_magazine',
    buildEntries: () =>
      threeTurns([
        ['ai', 'artificial intelligence', 'trust', 'technology'],
        ['ethics', 'safety', 'curious'],
        ['future', 'system', 'reflection'],
      ]),
  },
  {
    id: 'history-samarkand',
    label: 'Tarih / Osmanlı / Semerkant',
    season: 'film_poster',
    buildEntries: () =>
      threeTurns([
        ['history', 'ottoman', 'samarkand', 'heritage'],
        ['culture', 'journey', 'nostalgic'],
        ['archive', 'memory', 'curious'],
      ]),
  },
  {
    id: 'spirituality',
    label: 'Maneviyat',
    season: 'quiet_luxury',
    buildEntries: () =>
      threeTurns([
        ['spiritual', 'faith', 'reflection', 'inner'],
        ['silence', 'meaning', 'calm'],
        ['prayer', 'quiet', 'soul'],
      ]),
  },
  {
    id: 'health-balance',
    label: 'Sağlık',
    season: 'bright_cinematic',
    buildEntries: () =>
      threeTurns([
        ['health', 'wellness', 'balance', 'body'],
        ['rest', 'rhythm', 'care'],
        ['calm', 'recovery', 'habit'],
      ]),
  },
  {
    id: 'family-closeness',
    label: 'Aile',
    season: 'golden_hour',
    buildEntries: () =>
      threeTurns([
        ['family', 'home', 'together', 'closeness'],
        ['relationship', 'care', 'warm'],
        ['shared', 'quiet', 'love'],
      ]),
  },
  {
    id: 'shopping-choice',
    label: 'Alışveriş / ürün seçimi',
    season: 'night_discovery',
    buildEntries: () =>
      threeTurns([
        ['shopping', 'product', 'choice', 'compare'],
        ['quality', 'value', 'decision'],
        ['purchase', 'preference', 'focused'],
      ]),
  },
];

export const MIRROR_V2_QA_SCORE_LABELS: { key: keyof MirrorV2QaScore; label: string }[] = [
  { key: 'cinematicImpact', label: 'Sinematik etki' },
  { key: 'lowTextDensity', label: 'Metin azlığı' },
  { key: 'topicRecognition', label: 'Konu hissi' },
  { key: 'mirrorFeeling', label: 'Mirror hissi' },
  { key: 'shareValue', label: 'Paylaşım değeri' },
  { key: 'sainaIdentity', label: 'SAINA kimliği' },
];

const QA_STORAGE_KEY = 'eza_mirror_v2_qa_scores';

export function readMirrorV2QaScores(): Record<string, MirrorV2QaScore> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(QA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MirrorV2QaScore>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMirrorV2QaScore(scenarioId: string, score: MirrorV2QaScore): void {
  if (typeof window === 'undefined') return;
  const all = readMirrorV2QaScores();
  all[scenarioId] = { ...all[scenarioId], ...score };
  localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(all));
}
