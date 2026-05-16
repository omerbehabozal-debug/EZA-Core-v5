/**
 * Signal-first mapping for standalone chat — observational pills, scores in expand only.
 * Her girdi/çıktı turunda pill gösterilir (skor veya behavioral geldiğinde); detay expand’de.
 */

import type { BehavioralSnapshot } from '@/lib/types';
import type { InsightContext } from '@/lib/eza/behavioralInsights';

export interface SignalDetailRow {
  label: string;
  value: string;
}

export interface InteractionSignalView {
  emoji: string;
  label: string;
  details: SignalDetailRow[];
}

function normalizeScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1 && value >= 0) return Math.round(value * 100);
  return Math.round(Math.max(0, Math.min(100, value)));
}

function normalizeRisk(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  if (value <= 1 && value >= 0) return value;
  return value / 100;
}

function normalizeAlignment(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= 1 && value >= 0) return value;
  return value / 100;
}

function healthLabel(health: number | null | undefined): string {
  if (health === null || health === undefined || Number.isNaN(health)) return 'Ön gözlem';
  const h = health <= 1 ? health : health / 100;
  if (h >= 0.75) return 'Güçlü';
  if (h >= 0.5) return 'Orta';
  return 'Düşük';
}

function trustLabel(score: number | null): string {
  if (score === null) return 'Ön gözlem';
  if (score >= 78) return 'Güçlü';
  if (score >= 58) return 'Orta';
  return 'Ön gözlem';
}

function redirectDensityLabel(redirect: boolean, benign: boolean, harmful: boolean): string {
  if (!redirect) return 'Düşük';
  if (benign) return 'Düşük';
  if (harmful) return 'Orta';
  return 'Orta';
}

function isDecisionIntent(intent: string): boolean {
  return /decision|karar|choose|seçim/.test(intent);
}

function isClarityIntent(intent: string): boolean {
  return /verif|clarif|netlik|confirm|doğrula/.test(intent);
}

function buildAssistantDetails(
  score: number | null,
  ir: number,
  or: number,
  v: BehavioralSnapshot['vector']
): SignalDetailRow[] {
  const benign =
    v.redirect_benign === true ||
    (v.redirect && v.redirect_reason === 'high_input_risk' && or < 0.3);
  const harmful = v.redirect && !benign;

  const rows: SignalDetailRow[] = [];
  if (score !== null) {
    rows.push({ label: 'EZA Skoru', value: String(score) });
  }
  rows.push({ label: 'AI Yanıt Dengesi', value: healthLabel(v.output_health) });
  rows.push({
    label: 'Yönlendirme Yoğunluğu',
    value: redirectDensityLabel(v.redirect, benign, harmful),
  });
  rows.push({ label: 'Güven', value: trustLabel(score) });
  const align = normalizeAlignment(v.alignment_score);
  if (align !== null) {
    rows.push({
      label: 'Uyum',
      value: align >= 0.72 ? 'Güçlü' : align >= 0.5 ? 'Orta' : 'Düşük',
    });
  }
  if (ir >= 0.28) {
    rows.push({ label: 'Girdi sinyali', value: ir >= 0.45 ? 'Hassas' : 'Orta' });
  }
  return rows;
}

function buildUserDetails(
  score: number | null,
  ir: number,
  v?: BehavioralSnapshot['vector']
): SignalDetailRow[] {
  const rows: SignalDetailRow[] = [];
  if (score !== null) {
    rows.push({ label: 'EZA Skoru', value: String(score) });
  }
  const health = v?.input_health;
  rows.push({
    label: 'Girdi dengesi',
    value:
      health !== undefined
        ? healthLabel(health)
        : ir >= 0.45
          ? 'Dikkat'
          : ir < 0.3
            ? 'Dengeli'
            : 'Orta',
  });
  if (v?.intent) {
    const intent = v.intent.toLowerCase();
    if (isDecisionIntent(intent)) {
      rows.push({ label: 'Niyet', value: 'Karar desteği' });
    } else if (isClarityIntent(intent)) {
      rows.push({ label: 'Niyet', value: 'Netlik arayışı' });
    } else {
      rows.push({ label: 'Niyet', value: 'Genel' });
    }
  }
  rows.push({ label: 'Güven', value: trustLabel(score) });
  return rows;
}

function fallbackUserSignal(
  score: number | null,
  ir: number,
  v?: BehavioralSnapshot['vector']
): InteractionSignalView {
  if (ir >= 0.38) {
    return {
      emoji: '🟠',
      label: 'Girdi özeti',
      details: buildUserDetails(score, ir, v),
    };
  }
  if (score !== null && score >= 78) {
    return {
      emoji: '🟢',
      label: 'Dengeli etkileşim',
      details: buildUserDetails(score, ir, v),
    };
  }
  return {
    emoji: '⚪',
    label: 'Girdi özeti',
    details: buildUserDetails(score, ir, v),
  };
}

function fallbackAssistantSignal(
  score: number | null,
  ir: number,
  or: number,
  v: BehavioralSnapshot['vector']
): InteractionSignalView {
  if (score !== null && score >= 78 && or < 0.32) {
    return {
      emoji: '🟢',
      label: 'Yanıt dengesi korundu',
      details: buildAssistantDetails(score, ir, or, v),
    };
  }
  if (or < 0.28 && !v.redirect) {
    return {
      emoji: '⚪',
      label: 'Nötr AI tonu',
      details: buildAssistantDetails(score, ir, or, v),
    };
  }
  return {
    emoji: '🔵',
    label: 'Yanıt özeti',
    details: buildAssistantDetails(score, ir, or, v),
  };
}

function buildAssistantSignalFromVector(
  data: BehavioralSnapshot,
  ezaScore: number | null | undefined
): InteractionSignalView {
  const v = data.vector;
  const score = normalizeScore(ezaScore ?? v.eza_final ?? null);
  const ir = normalizeRisk(v.input_risk);
  const or = normalizeRisk(v.output_risk);
  const align = normalizeAlignment(v.alignment_score);

  const benignSafetyRedirect =
    v.redirect_benign === true ||
    (v.redirect && v.redirect_reason === 'high_input_risk' && or < 0.3);
  const harmfulRedirect = v.redirect && !benignSafetyRedirect;
  const splitSafe = ir >= 0.45 && or < 0.3;

  const details = () => buildAssistantDetails(score, ir, or, v);

  if (splitSafe || (benignSafetyRedirect && ir >= 0.4)) {
    return {
      emoji: '🟢',
      label: splitSafe ? 'Güvenli denge korundu' : 'Güvenli sınır korundu',
      details: details(),
    };
  }

  if (ir >= 0.42 && or < 0.38) {
    return {
      emoji: '🟠',
      label: 'Hassas sinyal gözlemlendi',
      details: details(),
    };
  }

  if (or >= 0.42 && !benignSafetyRedirect) {
    return {
      emoji: '🟠',
      label: 'Yanıt dikkat gerektiriyor',
      details: details(),
    };
  }

  if (align !== null && align >= 0.72 && or < 0.35 && score !== null && score >= 70) {
    return {
      emoji: '🔵',
      label: 'Açıklayıcı yanıt',
      details: details(),
    };
  }

  if (harmfulRedirect) {
    return {
      emoji: '🟠',
      label: 'Yönlendirme sinyali gözlemlendi',
      details: details(),
    };
  }

  return fallbackAssistantSignal(score, ir, or, v);
}

function buildUserSignalFromVector(
  data: BehavioralSnapshot,
  ezaScore: number | null | undefined
): InteractionSignalView {
  const v = data.vector;
  const score = normalizeScore(ezaScore ?? v.eza_final ?? null);
  const ir = normalizeRisk(v.input_risk);
  const intent = (v.intent || '').toLowerCase();
  const details = () => buildUserDetails(score, ir, v);

  if (isDecisionIntent(intent)) {
    return {
      emoji: '🟣',
      label: 'Karar desteği öne çıktı',
      details: details(),
    };
  }

  if (isClarityIntent(intent)) {
    return {
      emoji: '🔵',
      label: 'Netlik arayışı gözlemlendi',
      details: details(),
    };
  }

  if (ir >= 0.42) {
    return {
      emoji: '🟠',
      label: 'Hassas sinyal gözlemlendi',
      details: details(),
    };
  }

  return fallbackUserSignal(score, ir, v);
}

function buildUserSignalFromScoreOnly(score: number | null | undefined): InteractionSignalView | null {
  const normalized = normalizeScore(score ?? null);
  if (normalized === null) return null;

  const ir = Math.max(0, Math.min(1, (100 - normalized) / 100));

  if (normalized < 52) {
    return {
      emoji: '🟠',
      label: 'Hassas sinyal gözlemlendi',
      details: buildUserDetails(normalized, ir),
    };
  }

  return fallbackUserSignal(normalized, ir);
}

function buildAssistantSignalFromScoreOnly(
  score: number | null | undefined
): InteractionSignalView | null {
  const normalized = normalizeScore(score ?? null);
  if (normalized === null) return null;

  if (normalized < 52) {
    return {
      emoji: '🟠',
      label: 'Yanıt dikkat gerektiriyor',
      details: [
        { label: 'EZA Skoru', value: String(normalized) },
        { label: 'AI Yanıt Dengesi', value: 'Düşük' },
        { label: 'Yönlendirme Yoğunluğu', value: 'Ön gözlem' },
        { label: 'Güven', value: trustLabel(normalized) },
      ],
    };
  }

  const stubVector = {
    input_risk: 0,
    output_risk: Math.max(0, (100 - normalized) / 200),
    input_health: normalized / 100,
    output_health: normalized / 100,
    alignment_score: null,
    eza_final: normalized,
    intent: '',
    alignment_verdict: null,
    redirect: false,
    redirect_reason: null,
    policy_violation_count: 0,
  } as BehavioralSnapshot['vector'];

  return fallbackAssistantSignal(normalized, 0, stubVector.output_risk, stubVector);
}

export function buildInteractionSignal(
  context: InsightContext,
  ezaScore: number | null | undefined,
  data?: BehavioralSnapshot | null
): InteractionSignalView | null {
  if (ezaScore === undefined && !data?.vector) return null;

  if (data?.vector) {
    return context === 'user'
      ? buildUserSignalFromVector(data, ezaScore)
      : buildAssistantSignalFromVector(data, ezaScore);
  }

  return context === 'user'
    ? buildUserSignalFromScoreOnly(ezaScore)
    : buildAssistantSignalFromScoreOnly(ezaScore);
}
