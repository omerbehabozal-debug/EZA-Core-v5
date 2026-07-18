/**
 * Mirror V3 — build full MirrorStateResult (image-only poster UI).
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
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import { buildMirrorV3SeedHint } from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { MIRROR_PIPELINE_VERSION } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorCuriosityBundle } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';
import type { MirrorShareIdentity } from '@/lib/eza/mirror-share/types';

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
  payload: SainaMirrorV3Payload,
  entries: SavedBehavioralEntry[],
  hasEnoughData: boolean
): DailyMirrorCardModel {
  const latest = sortNewestFirst(entries)[0];
  const dateIso = latest?.savedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const visual = buildVisualPayloadFromMirrorV3(payload, {
    seedHint: buildMirrorV3SeedHint(payload),
  });

  const pipeline = payload.curiosityBundle ?? buildMirrorCuriosityBundle(payload);
  const blob = (payload.conversationEvidence ?? [])
    .map((item) => `${item.label} ${item.visualHint ?? ''}`)
    .join(' ')
    .toLowerCase();
  const shareVoice = pipeline.shareVoice!;
  const mirrorShare: MirrorShareIdentity = {
    blueprint: buildShareBlueprint(pipeline, blob),
    shareVoice,
    shareUrl: null,
  };

  return {
    date: dateIso,
    dayLabel: formatDayLabelTr(dateIso),
    headline: payload.mirrorTitle,
    characterName: 'SAINA',
    personaFamilyId: 'balanced_calm',
    shortInsight: payload.mirrorText,
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: hasEnoughData ? 'Sinematik ayna' : 'İzleniyor',
    energyLabel: '',
    energyScore: null,
    shareEnabled: hasEnoughData,
    privacyText: BEHAVIORAL_DISCLAIMER,
    quote: payload.closingLine,
    mirrorStory: payload.mirrorText,
    dailyJourney: payload.mirrorTitle,
    dailyThemeTitle: payload.narrativeTheme,
    dailyThemeSubtitle: payload.meaning,
    dailySceneConcept: payload.sceneMetaphor,
    visual,
    renderMode: 'hybrid_middle',
    mirrorPipelineVersion: MIRROR_PIPELINE_VERSION,
    mirrorSeason: payload.season,
    closingLine: payload.closingLine,
    mirrorV3Payload: payload,
    mirrorShare,
  };
}

export function buildMirrorStateV3(
  entries: SavedBehavioralEntry[],
  options?: BuildMirrorStateOptions
): MirrorStateResult {
  const sampleCount = entries.length;
  const hasEnoughData = sampleCount >= MIRROR_MIN_SAMPLES;
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const seed =
    options?.seed ??
    `mirror-v3-${sampleCount}-${sortNewestFirst(entries)[0]?.interaction_id ?? 'empty'}`;

  const payload = buildMirrorPayloadV3(entries, {
    seed,
    conversationId:
      options?.conversationId ??
      `mirror-v3-${sampleCount}-${sortNewestFirst(entries)[0]?.interaction_id ?? 'empty'}`,
    ...(options?.conversationTexts?.length
      ? { conversationTexts: options.conversationTexts }
      : {}),
  });
  const patternState = buildRelationshipPatternState(entries, options?.periodDays, {
    generatedAt,
  });

  const warnings = [...patternState.meta.warnings];
  if (payload.safetyLevel !== 'normal') {
    warnings.push(`safety_${payload.safetyLevel}`);
  }
  warnings.push('pipeline_v3');

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

export type { SainaMirrorV3Payload };
