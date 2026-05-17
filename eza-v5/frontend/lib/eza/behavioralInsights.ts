/**
 * Human-readable interaction insights from behavioral snapshots (no debug dump).
 */

import type { BehavioralSnapshot } from '@/lib/types';
import type { PresentationTone } from '@/lib/eza/presentationTone';
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

function insightBulletsForTone(
  tone: PresentationTone,
  safe: boolean,
  aligned: boolean,
  alignment: number | null,
  benignSafetyRedirect: boolean,
  harmfulRedirect: boolean
): InsightBullet[] {
  if (tone === 'standalone') {
    return [
      {
        tone: safe ? 'positive' : 'caution',
        text: safe ? 'Yanıt tonu dengeli kaldı' : 'Yanıt tonunda dikkat sinyali',
      },
      {
        tone: aligned ? 'positive' : alignment === null ? 'neutral' : 'caution',
        text: aligned
          ? 'Soru bağlamıyla uyum sinyali güçlü'
          : alignment === null
            ? 'Uyum için daha fazla veri gerekli'
            : 'Uyum sinyali zayıf kaldı',
      },
      {
        tone: benignSafetyRedirect ? 'positive' : harmfulRedirect ? 'caution' : 'positive',
        text: benignSafetyRedirect
          ? 'Güvenli sınır korundu'
          : harmfulRedirect
            ? 'Yönlendirme sinyali gözlemlendi'
            : 'Yönlendirme baskısı düşük',
      },
    ];
  }

  return [
    {
      tone: safe ? 'positive' : 'caution',
      text: safe ? 'Güvenli etkileşim' : 'Çıktı dikkat gerektiriyor',
    },
    {
      tone: aligned ? 'positive' : alignment === null ? 'neutral' : 'caution',
      text: aligned ? 'Yüksek uyum' : alignment === null ? 'Uyum verisi sınırlı' : 'Uyum sinyali zayıf',
    },
    {
      tone: benignSafetyRedirect ? 'positive' : harmfulRedirect ? 'caution' : 'positive',
      text: benignSafetyRedirect
        ? 'Güvenli red ve olumlu yönlendirme'
        : harmfulRedirect
          ? 'Riskli yönlendirme sinyali'
          : 'Düşük yönlendirme sinyali',
    },
  ];
}

export function buildInteractionInsight(
  data: BehavioralSnapshot,
  displayScore?: number | null,
  tone: PresentationTone = 'standalone'
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

  const benignSafetyRedirect =
    v.redirect_benign === true ||
    (v.redirect && v.redirect_reason === 'high_input_risk' && (v.output_risk ?? 1) < 0.3);
  const harmfulRedirect = v.redirect && !benignSafetyRedirect;

  const bullets = insightBulletsForTone(
    tone,
    safe,
    aligned,
    alignment,
    benignSafetyRedirect,
    harmfulRedirect
  );

  return {
    title: tone === 'standalone' ? 'Gözlem özeti' : 'Etkileşim özeti',
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
  context: InsightContext = 'assistant',
  tone: PresentationTone = 'standalone'
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

  const bullets: InsightBullet[] =
    tone === 'standalone'
      ? [
          {
            tone: safe ? 'positive' : 'caution',
            text: isUser
              ? safe
                ? 'Soru tonu dengeli'
                : 'Soru tonunda dikkat sinyali'
              : safe
                ? 'Yanıt tonu dengeli'
                : 'Yanıt tonunda dikkat sinyali',
          },
          {
            tone: strong ? 'positive' : weak ? 'caution' : 'neutral',
            text: `${riskLabel} · ${strong ? 'Güçlü sinyal' : weak ? 'Zayıf sinyal' : 'Orta sinyal'}`,
          },
          {
            tone: normalized >= 51 ? 'positive' : 'caution',
            text: isUser
              ? 'Konuşma sinyali kaydedildi'
              : 'Yanıt sinyali kaydedildi',
          },
        ]
      : [
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
        ];

  return {
    title: 'EZA Skoru',
    scoreLabel: 'EZA Skoru',
    score: normalized,
    bullets,
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
