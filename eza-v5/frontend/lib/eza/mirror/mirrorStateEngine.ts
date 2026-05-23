/**
 * EZA Mirror State Engine — pure composition over existing builders.
 *
 * No localStorage, API, or UI. Input: SavedBehavioralEntry[] → mirror view models.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { BEHAVIORAL_DISCLAIMER } from '@/lib/eza/behavioralDashboard';
import { buildDailyObservationFromEntries } from '@/lib/eza/dailyObservation';
import {
  buildRelationshipMap,
  type BehaviorIsland,
  type RelationshipPeriodDays,
} from '@/lib/eza/relationshipMapModel';
import { buildPersonaSeed } from '@/lib/standaloneObservation';
import { pickStandalonePersona, type PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { composeEmotionalReflection } from '@/lib/eza/mirror/reflectionToneEngine';
import { composeMirrorStory } from '@/lib/eza/mirror/mirrorStoryEngine';
import { buildMirrorVisualFromContext, buildFallbackMirrorVisual } from '@/lib/eza/mirror/visualPromptEngine';
import { resolveMirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import { buildHybridPosterTextFields } from '@/lib/eza/mirror/posterCardContent';
import { SCENE_TOPIC_LABEL } from '@/lib/eza/mirror/visualPromptPresets';
import { resolveMirrorIntentContext } from '@/lib/eza/mirror/mirrorIntentContext';
import {
  MIRROR_MIN_SAMPLES,
  type BuildMirrorStateOptions,
  type DailyMirrorCardModel,
  type MirrorBehaviorIsland,
  type MirrorRisingPattern,
  type MirrorStateResult,
  type RelationshipPatternModel,
} from '@/lib/eza/mirror/types';

const DEFAULT_PERIOD: RelationshipPeriodDays = 30;
const EMPTY_DATE = new Date(0).toISOString().slice(0, 10);

function sortNewestFirst(entries: SavedBehavioralEntry[]): SavedBehavioralEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

function resolveReferenceDate(entries: SavedBehavioralEntry[]): Date {
  const latest = sortNewestFirst(entries)[0];
  if (!latest?.savedAt) return new Date();
  const d = new Date(latest.savedAt);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabelTr(d: Date): string {
  return d.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function avgNumeric(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function collectEzaScores(entries: SavedBehavioralEntry[]): number[] {
  return entries
    .map((e) => e.vector.eza_final)
    .filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v))
    .map((v) => (v <= 1 ? v * 100 : v));
}

function collectAlignScores(entries: SavedBehavioralEntry[]): number[] {
  return entries
    .map((e) => e.vector.alignment_score)
    .filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v))
    .map((v) => (v <= 1 ? v * 100 : v));
}

function deriveEnergyScore(entries: SavedBehavioralEntry[]): number | null {
  const eza = avgNumeric(collectEzaScores(entries));
  if (eza !== null) return Math.round(Math.max(0, Math.min(100, eza)));
  const align = avgNumeric(collectAlignScores(entries));
  if (align !== null) return Math.round(Math.max(0, Math.min(100, align)));
  return null;
}

function energyLabelFromScore(score: number | null): string {
  if (score === null) return 'İzleniyor';
  if (score >= 80) return 'Yüksek odak';
  if (score >= 65) return 'Dengeli enerji';
  if (score >= 50) return 'Ölçülü tempo';
  return 'Dikkatli tempo';
}

function normalizeConfidenceLabel(raw: string | undefined): string {
  const t = raw?.trim();
  if (!t) return 'İzleniyor';
  if (/^güven\s*:/i.test(t)) return t;
  return `Güven: ${t}`;
}

function mapIsland(island: BehaviorIsland): MirrorBehaviorIsland {
  return {
    id: island.id,
    label: island.label,
    percent: island.percent,
    trend: island.trend,
    description: island.description,
    intensity: island.intensity,
  };
}

function findRisingPattern(islands: MirrorBehaviorIsland[]): MirrorRisingPattern | null {
  const growing = islands.find((i) => i.trend === 'growing');
  if (!growing) return null;
  return {
    label: growing.label,
    trend: 'growing',
    description: growing.description,
  };
}

function buildRhythmSummary(
  periodDays: RelationshipPeriodDays,
  totalInteractions: number,
  timeline: { label: string; value: number }[]
): string {
  if (totalInteractions === 0) {
    return 'Henüz ritim özeti oluşmadı; birkaç sohbetten sonra zaman içi desen burada görünür.';
  }
  if (!timeline.length) {
    return `Son ${periodDays} günde ${totalInteractions} etkileşim kaydı var; günlük ritim henüz seyrek.`;
  }
  const peak = [...timeline].sort((a, b) => b.value - a.value)[0]!;
  return `Son ${periodDays} günde ${totalInteractions} etkileşim; en yoğun gün ${peak.label} (${peak.value} kayıt).`;
}

function patternConfidenceLabel(avgDepthScore: number | null, sampleCount: number): string {
  if (sampleCount < MIRROR_MIN_SAMPLES) {
    return 'Henüz erken — daha fazla etkileşim gerekli';
  }
  if (avgDepthScore === null) return 'İzleniyor';
  if (avgDepthScore >= 7.5) return 'Güçlü desen sinyali';
  if (avgDepthScore >= 5.5) return 'Orta düzey desen sinyali';
  return 'Hafif desen sinyali';
}

function collectWarnings(
  entries: SavedBehavioralEntry[],
  sampleCount: number,
  hasEnoughData: boolean
): string[] {
  const warnings: string[] = [];
  if (sampleCount === 0) {
    warnings.push('empty_history');
    return warnings;
  }
  if (!hasEnoughData) {
    warnings.push('insufficient_samples');
  }
  const hasObservation = entries.some((e) => e.standaloneObservation != null);
  if (!hasObservation) {
    warnings.push('no_backend_observation');
  }
  const placeholderOnly = entries.every(
    (e) => e.vector.eza_final === null && e.vector.alignment_score === null
  );
  if (placeholderOnly && sampleCount > 0) {
    warnings.push('sparse_numeric_vectors');
  }
  return warnings;
}

function emptyDailyMirrorCard(privacyText: string): DailyMirrorCardModel {
  return {
    date: EMPTY_DATE,
    dayLabel: 'Henüz gözlem yok',
    headline: 'Bugün AI ile ilişkin nasıl?',
    characterName: '',
    personaFamilyId: 'balanced_calm',
    shortInsight: 'Birkaç sohbetten sonra gözlemin burada belirecek.',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: 'İzleniyor',
    energyLabel: 'İzleniyor',
    energyScore: null,
    shareEnabled: false,
    privacyText,
    visual: buildFallbackMirrorVisual('balanced_calm', '', 'mirror-empty'),
  };
}

function buildDailyMirrorCard(
  entries: SavedBehavioralEntry[],
  seed: string,
  hasEnoughData: boolean,
  privacyText: string
): DailyMirrorCardModel {
  if (entries.length === 0) {
    return emptyDailyMirrorCard(privacyText);
  }

  const refDate = resolveReferenceDate(entries);
  const energyScore = deriveEnergyScore(entries);
  const observation = buildDailyObservationFromEntries(entries, {
    seed,
    tone: 'standalone',
    confidencePct: energyScore,
  });

  const personaFamilyId: PersonaFamilyId =
    observation.personaFamilyId ??
    (observation.categoryId as PersonaFamilyId | undefined) ??
    'balanced_calm';
  const personaSeed = buildPersonaSeed(entries, personaFamilyId);
  const persona = pickStandalonePersona(
    observation.personaFamilyId ?? observation.categoryId,
    personaSeed
  );

  const emotional = composeEmotionalReflection({
    entries,
    seed,
    observationHeadline: observation.manset || observation.primaryInsight,
    observationInsight: observation.primaryInsight || observation.supportLine,
    personaFamilyId,
  });

  const story = composeMirrorStory({
    entries,
    seed,
    reflectionTone: emotional.reflectionTone,
    emotionalRhythm: emotional.emotionalRhythm,
    personaFamilyId,
    observationCategoryId: observation.categoryId,
    reflectionSignals: emotional.reflectionSignals,
    microMood: emotional.microMood,
  });

  const shareEnabled =
    hasEnoughData && observation.show && Boolean(observation.userLine?.trim());

  const energyLabel = energyLabelFromScore(energyScore);
  const intentCtx = resolveMirrorIntentContext({
    entries,
    storyVariant: story.storyVariant,
    reflectionSignals: story.reflectionSignals,
    reflectionTone: emotional.reflectionTone,
    personaFamilyId,
    observationCategoryId: observation.categoryId,
  });

  const atmosphereOverride =
    intentCtx.lockedIntent === 'premium_vehicle_comparison'
      ? 'warm premium showroom decision atmosphere comfort priority'
      : story.visualAtmosphereBoost ?? emotional.visualAtmosphere;

  const renderMode = resolveMirrorRenderMode();
  const storyTopicKey = story.storyTopicKey ?? 'general';
  const hybridCopy =
    renderMode === 'hybrid_middle'
      ? buildHybridPosterTextFields({
          dailyJourney: story.dailyJourney,
          headline: story.dailyJourney || emotional.headline,
          mirrorStory: story.mirrorStory,
          quote: emotional.quote,
          themeDescription: emotional.themeDescription,
          personaFamilyId,
          topicLabel: SCENE_TOPIC_LABEL[storyTopicKey],
          reflectionTone: emotional.reflectionTone,
          lockedIntent: intentCtx.lockedIntent,
          seed: `${seed}-hybrid`,
        })
      : undefined;

  const visual = buildMirrorVisualFromContext({
    entries,
    characterName: persona.name,
    personaFamilyId,
    observationCategoryId: observation.categoryId,
    energyLabel,
    seed: `${seed}-visual`,
    reflectionTone: emotional.reflectionTone,
    atmosphereOverride,
    emotionOverride: emotional.visualEmotion,
    toneHints: emotional.toneHints,
    storyTopicKey: story.storyTopicKey,
    storyVariant: story.storyVariant,
    reflectionSignals: story.reflectionSignals,
    visualStoryHints:
      intentCtx.lockedIntent === 'premium_vehicle_comparison'
        ? []
        : story.visualStoryHints,
    lockedIntent: intentCtx.lockedIntent,
    intentFingerprint: intentCtx.intentFingerprint,
    renderMode,
    hybridCopy,
  });

  const storyHeadline = story.dailyJourney;
  const storyInsight = story.mirrorStory;

  return {
    date: formatDateIso(refDate),
    dayLabel: formatDayLabelTr(refDate),
    headline: storyHeadline || emotional.headline,
    characterName: persona.name,
    personaFamilyId,
    shortInsight: storyInsight || emotional.shortInsight,
    userLine: story.userStoryLine,
    aiLine: story.aiStoryLine,
    balanceLine: story.balanceStoryLine,
    signalLevel: observation.signalLevel,
    confidence: normalizeConfidenceLabel(observation.confidenceLabel),
    energyLabel,
    energyScore,
    shareEnabled,
    privacyText,
    reflectionTone: emotional.reflectionTone,
    reflectionWeight: emotional.reflectionWeight,
    emotionalRhythm: emotional.emotionalRhythm,
    toneHints: emotional.toneHints,
    quote: emotional.quote,
    tomorrowHint: emotional.tomorrowHint,
    themeDescription: emotional.themeDescription,
    mirrorStory: story.mirrorStory,
    dailyJourney: story.dailyJourney,
    relationshipMode: story.relationshipMode,
    storyTone: story.storyTone,
    storyTopicKey: story.storyTopicKey,
    storyVariant: story.storyVariant,
    microMood: story.microMood,
    reflectionSignals: story.reflectionSignals,
    visual,
  };
}

function buildRelationshipPattern(
  entries: SavedBehavioralEntry[],
  periodDays: RelationshipPeriodDays
): RelationshipPatternModel {
  const map = buildRelationshipMap(entries, periodDays);
  const behaviorIslands = map.islands.map(mapIsland);
  const dominantIsland = behaviorIslands[0] ?? null;
  const risingPattern = findRisingPattern(behaviorIslands);

  return {
    period: periodDays,
    generalBalanceLabel: map.generalBalanceLabel,
    behaviorIslands,
    dominantIsland,
    risingPattern,
    rhythmSummary: buildRhythmSummary(
      periodDays,
      map.totalInteractions,
      map.rhythmTimeline
    ),
    editorialNote: map.editorialNote,
    confidence: patternConfidenceLabel(map.avgDepthScore, map.totalInteractions),
    isShareable: false,
  };
}

/**
 * Build EZA Mirror state from behavioral history entries.
 */
export function buildMirrorState(
  entries: SavedBehavioralEntry[],
  options?: BuildMirrorStateOptions
): MirrorStateResult {
  const periodDays = options?.periodDays ?? DEFAULT_PERIOD;
  const sampleCount = entries.length;
  const hasEnoughData = sampleCount >= MIRROR_MIN_SAMPLES;
  const seed =
    options?.seed ??
    `mirror-${sampleCount}-${sortNewestFirst(entries)[0]?.interaction_id ?? 'empty'}`;
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const privacyText = BEHAVIORAL_DISCLAIMER;

  const dailyMirrorCard = buildDailyMirrorCard(
    entries,
    seed,
    hasEnoughData,
    privacyText
  );
  const relationshipPattern = buildRelationshipPattern(entries, periodDays);
  const warnings = collectWarnings(entries, sampleCount, hasEnoughData);

  return {
    dailyMirrorCard,
    relationshipPattern,
    meta: {
      hasEnoughData,
      sampleCount,
      source: 'local_history',
      generatedAt,
      warnings,
    },
  };
}

export type {
  BuildMirrorStateOptions,
  DailyMirrorCardModel,
  MirrorStateMeta,
  MirrorStateResult,
  RelationshipPatternModel,
} from '@/lib/eza/mirror/types';
