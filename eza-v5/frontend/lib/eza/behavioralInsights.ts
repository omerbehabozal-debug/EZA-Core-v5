/**
 * Human-readable interaction insights from behavioral snapshots (no debug dump).
 */

import type { BehavioralSnapshot } from '@/lib/types';
import { scoreToEzaRiskLevel } from '@/lib/eza/standaloneSkin';

export type InsightTone = 'positive' | 'neutral' | 'caution';

export interface InsightBullet {
  tone: InsightTone;
  text: string;
}

export interface InteractionInsightView {
  title: string;
  scoreLabel: string;
  score: number | null;
  bullets: InsightBullet[];
}

function normalizeScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1 && value >= 0) return Math.round(value * 100);
  return Math.round(Math.max(0, Math.min(100, value)));
}

function normalizeAlignment(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1 && value >= 0) return value;
  return value / 100;
}

export function buildInteractionInsight(
  data: BehavioralSnapshot,
  displayScore?: number | null
): InteractionInsightView {
  const v = data.vector;
  const score = normalizeScore(displayScore ?? v.eza_final ?? null);
  const outputRisk = v.output_risk ?? 0;
  const alignment = normalizeAlignment(v.alignment_score);

  const safe =
    score !== null
      ? score >= 70
      : outputRisk < 0.4;

  const verdict = v.alignment_verdict?.toLowerCase() ?? '';
  const aligned =
    alignment !== null ? alignment >= 0.65 : verdict.includes('align') || verdict.includes('uyum');

  const lowRedirect = !v.redirect;

  const bullets: InsightBullet[] = [
    {
      tone: safe ? 'positive' : 'caution',
      text: safe ? 'Güvenli etkileşim' : 'Çıktı dikkat gerektiriyor',
    },
    {
      tone: aligned ? 'positive' : alignment === null ? 'neutral' : 'caution',
      text: aligned ? 'Yüksek uyum' : alignment === null ? 'Uyum verisi sınırlı' : 'Uyum sinyali zayıf',
    },
    {
      tone: lowRedirect ? 'positive' : 'caution',
      text: lowRedirect ? 'Düşük yönlendirme sinyali' : 'Yönlendirme önerildi',
    },
  ];

  return {
    title: 'Etkileşim özeti',
    scoreLabel: 'EZA Skoru',
    score,
    bullets,
  };
}

const RISK_LABELS = {
  low: 'Düşük risk',
  medium: 'Orta risk',
  high: 'Yüksek risk',
  critical: 'Kritik risk',
  unknown: 'Belirsiz risk',
} as const;

export function getScoreRiskLabel(score: number): string {
  const level = scoreToEzaRiskLevel(score);
  return RISK_LABELS[level] ?? RISK_LABELS.unknown;
}

export type InsightContext = 'user' | 'assistant';

/** Skor-only insight when behavioral snapshot is not yet available */
export function buildScoreOnlyInsight(
  score: number | null | undefined,
  context: InsightContext = 'assistant'
): InteractionInsightView {
  const normalized = normalizeScore(score ?? null);
  const isUser = context === 'user';

  if (normalized === null) {
    return {
      title: 'EZA Skoru',
      scoreLabel: 'EZA Skoru',
      score: null,
      bullets: [
        { tone: 'neutral', text: 'Skor hesaplanıyor' },
        {
          tone: 'neutral',
          text: isUser ? 'Girdi değerlendiriliyor' : 'Yanıt değerlendirme sürüyor',
        },
      ],
    };
  }

  const safe = normalized >= 70;
  const strong = normalized >= 81;
  const weak = normalized < 51;
  const riskLabel = getScoreRiskLabel(normalized);

  return {
    title: 'EZA Skoru',
    scoreLabel: 'EZA Skoru',
    score: normalized,
    bullets: [
      {
        tone: safe ? 'positive' : 'caution',
        text: isUser
          ? safe
            ? 'Güvenli girdi'
            : 'Dikkat gerektiren girdi'
          : safe
            ? 'Güvenli etkileşim'
            : 'Çıktı dikkat gerektiriyor',
      },
      {
        tone: strong ? 'positive' : weak ? 'caution' : 'neutral',
        text: `${riskLabel} · ${strong ? 'Yüksek güven' : weak ? 'Düşük güven' : 'Orta güven'}`,
      },
      {
        tone: normalized >= 51 ? 'positive' : 'caution',
        text: isUser
          ? normalized >= 81
            ? 'Kabul edilebilir girdi profili'
            : 'Girdi incelemesi önerilir'
          : normalized >= 81
            ? 'Kabul edilebilir risk profili'
            : 'İnceleme önerilir',
      },
    ],
  };
}

/** One-line summary for collapsed insight chip */
export function getInsightSummaryLine(insight: InteractionInsightView): string {
  const primary =
    insight.bullets.find((b) => b.tone === 'positive')?.text ??
    insight.bullets[0]?.text ??
    'Özet';
  if (insight.score !== null) {
    return `EZA Skoru ${insight.score} · ${primary}`;
  }
  return primary;
}
