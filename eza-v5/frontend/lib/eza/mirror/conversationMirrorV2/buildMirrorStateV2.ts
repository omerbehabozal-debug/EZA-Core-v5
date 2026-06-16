/**
 * Mirror V2 — build full MirrorStateResult (V1-compatible contract).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { BEHAVIORAL_DISCLAIMER } from '@/lib/eza/behavioralDashboard';
import {
  buildRelationshipPatternState,
  type BuildMirrorStateOptions,
} from '@/lib/eza/mirror/mirrorStateEngine';
import {
  MIRROR_MIN_SAMPLES,
  type DailyMirrorCardModel,
  type MirrorStateResult,
} from '@/lib/eza/mirror/types';
import { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildVisualPayloadFromMirrorV2 } from '@/lib/eza/mirror/conversationMirrorV2/visualPayloadAdapter';
import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { MIRROR_PIPELINE_VERSION } from '@/lib/eza/mirror/conversationMirrorV2/types';

function sortNewestFirst(entries: SavedBehavioralEntry[]): SavedBehavioralEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

function formatDayLabelTr(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function adaptPayloadToDailyCard(
  payload: SainaMirrorPayload,
  entries: SavedBehavioralEntry[],
  hasEnoughData: boolean
): DailyMirrorCardModel {
  const latest = sortNewestFirst(entries)[0];
  const dateIso = latest?.savedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const visual = buildVisualPayloadFromMirrorV2(payload, {
    seedHint: `v2-${payload.conversationId}`,
  });

  return {
    date: dateIso,
    dayLabel: formatDayLabelTr(dateIso),
    headline: payload.mirrorTitle,
    characterName: 'SAINA Mirror',
    personaFamilyId: 'balanced_calm',
    shortInsight: payload.mirrorText,
    userLine: '',
    aiLine: '',
    balanceLine: payload.closingLine ?? '',
    signalLevel: '',
    confidence: hasEnoughData ? 'Sinematik ayna' : 'İzleniyor',
    energyLabel: payload.emotionalTone,
    energyScore: null,
    shareEnabled: hasEnoughData,
    privacyText: BEHAVIORAL_DISCLAIMER,
    quote: payload.closingLine,
    mirrorStory: payload.mirrorText,
    dailyJourney: payload.mirrorTitle,
    dailyThemeTitle: payload.topic,
    dailyThemeSubtitle: payload.topicSummary,
    dailySceneConcept: payload.sceneMetaphor,
    visual,
    renderMode: 'hybrid_middle',
    mirrorPipelineVersion: MIRROR_PIPELINE_VERSION,
    mirrorSeason: payload.season,
    closingLine: payload.closingLine,
    mirrorV2Payload: payload,
  };
}

export function buildMirrorStateV2(
  entries: SavedBehavioralEntry[],
  options?: BuildMirrorStateOptions
): MirrorStateResult {
  const sampleCount = entries.length;
  const hasEnoughData = sampleCount >= MIRROR_MIN_SAMPLES;
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const seed =
    options?.seed ??
    `mirror-v2-${sampleCount}-${sortNewestFirst(entries)[0]?.interaction_id ?? 'empty'}`;

  const payload = buildMirrorPayload(entries, {
    seed,
    conversationId:
      options?.conversationId ??
      `mirror-v2-${sampleCount}-${sortNewestFirst(entries)[0]?.interaction_id ?? 'empty'}`,
  });
  const patternState = buildRelationshipPatternState(entries, options?.periodDays, {
    generatedAt,
  });

  const warnings = [...patternState.meta.warnings];
  if (payload.safetyLevel !== 'normal') {
    warnings.push(`safety_${payload.safetyLevel}`);
  }
  warnings.push('pipeline_v2');

  const dailyMirrorCard = hasEnoughData
    ? adaptPayloadToDailyCard(payload, entries, true)
    : adaptPayloadToDailyCard(
        {
          ...payload,
          mirrorTitle: 'Henüz bir ayna başlığı yok',
          mirrorText: 'Birkaç sohbetten sonra sinematik aynan burada belirecek.',
          closingLine: undefined,
        },
        entries,
        false
      );

  if (!hasEnoughData) {
    dailyMirrorCard.shareEnabled = false;
  }

  return {
    dailyMirrorCard,
    relationshipPattern: patternState.pattern,
    meta: {
      hasEnoughData,
      sampleCount,
      source: 'local_history',
      generatedAt,
      warnings,
      pipelineVersion: MIRROR_PIPELINE_VERSION,
    },
  };
}

export type { SainaMirrorPayload };
