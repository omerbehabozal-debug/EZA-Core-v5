/**
 * Mirror V2 — extract cinematic poster payload from behavioral entries.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildDailyObservationFromEntries } from '@/lib/eza/dailyObservation';
import { composeEmotionalReflection } from '@/lib/eza/mirror/reflectionToneEngine';
import { composeMirrorStory } from '@/lib/eza/mirror/mirrorStoryEngine';
import type {
  SainaMirrorEmotionalTone,
  SainaMirrorPayload,
  SainaMirrorSeason,
} from '@/lib/eza/mirror/conversationMirrorV2/types';
import { resolveActiveSeason } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import {
  applySafetyToScene,
  assessMirrorSafetyLevel,
} from '@/lib/eza/mirror/conversationMirrorV2/safetyFilter';
import {
  composeTopicMirrorCopy,
  trimWordCount,
} from '@/lib/eza/mirror/conversationMirrorV2/topicCatalog';
import { composeSelectedTopicMirrorCopy } from '@/lib/eza/mirror/conversationMirrorV2/selectedTopicMirrorCopy';
import { resolveActiveConversationTopics } from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';

export type BuildMirrorPayloadOptions = {
  /** Required for Conversation Mirror — scopes topic selection to one chat thread. */
  conversationId: string;
  date?: Date;
  season?: SainaMirrorSeason;
  seed?: string;
};

function formatDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateTr(d: Date): string {
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function mapReflectionToneToEmotional(
  tone: ReflectionToneId,
  fallback: SainaMirrorEmotionalTone
): SainaMirrorEmotionalTone {
  const map: Partial<Record<ReflectionToneId, SainaMirrorEmotionalTone>> = {
    curious_light: 'curious',
    focused_growth: 'focused',
    calm_reflective: 'reflective',
    quietly_confident: 'hopeful',
    emotionally_cautious: 'uncertain',
    thoughtful: 'reflective',
    emotionally_open: 'hopeful',
    mentally_tired: 'calm',
    rebuilding: 'hopeful',
  };
  return map[tone] ?? fallback;
}

export function buildMirrorPayload(
  entries: SavedBehavioralEntry[],
  options: BuildMirrorPayloadOptions
): SainaMirrorPayload {
  const refDate = entries[0]?.savedAt ? new Date(entries[0].savedAt) : options?.date ?? new Date();
  const dateIso = formatDateIso(refDate);
  const seed =
    options.seed ??
    `v2-${options.conversationId}-${entries.length}-${entries[0]?.interaction_id ?? 'empty'}-${dateIso}`;
  const conversationId = options.conversationId;

  const topicResolution = resolveActiveConversationTopics(entries, seed);
  const observation = buildDailyObservationFromEntries(entries, {
    seed,
    tone: 'standalone',
  });
  const personaFamilyId: PersonaFamilyId =
    observation.personaFamilyId ?? 'balanced_calm';

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

  const storyLine = story.dailyJourney || story.mirrorStory || emotional.quote;
  const selectedCopy = composeSelectedTopicMirrorCopy(
    topicResolution.selectedTopic,
    seed,
    storyLine
  );
  const topicCopy = selectedCopy
    ? {
        topicLabel: topicResolution.selectedTopic,
        mirrorTitle: selectedCopy.mirrorTitle,
        mirrorText: selectedCopy.mirrorText,
        closingLine: selectedCopy.closingLine,
        sceneMetaphor: selectedCopy.sceneMetaphor,
        visualKeywords: selectedCopy.visualKeywords,
        emotionalTone: selectedCopy.emotionalTone,
      }
    : composeTopicMirrorCopy(topicResolution.primaryTopic, seed, storyLine);

  const emotionalTone = selectedCopy
    ? topicCopy.emotionalTone
    : mapReflectionToneToEmotional(emotional.reflectionTone, topicCopy.emotionalTone);

  const seasonProfile = resolveActiveSeason(refDate, options?.season);
  const safetyLevel = assessMirrorSafetyLevel(entries);

  const topicSummary = trimWordCount(
    selectedCopy?.topicSummary ??
      (observation.primaryInsight ||
        topicResolution.selectedTopic ||
        topicCopy.topicLabel),
    28
  );

  const sceneBase = selectedCopy
    ? topicCopy.sceneMetaphor
    : story.visualAtmosphereBoost
      ? `${topicCopy.sceneMetaphor}. ${story.visualAtmosphereBoost}`
      : topicCopy.sceneMetaphor;

  const keywords = (
    selectedCopy
      ? topicCopy.visualKeywords
      : Array.from(
          new Set([...topicCopy.visualKeywords, ...story.visualStoryHints.slice(0, 4)])
        )
  ).slice(0, 8);

  const safeScene = applySafetyToScene({
    safetyLevel,
    sceneMetaphor: sceneBase,
    visualKeywords: keywords,
  });

  return {
    conversationId,
    date: formatDateTr(refDate),
    season: seasonProfile.id,
    topic: topicCopy.topicLabel,
    selectedTopic: topicResolution.selectedTopic,
    candidateTopics: topicResolution.candidateTopics,
    topicSummary,
    emotionalTone,
    mirrorTitle: topicCopy.mirrorTitle,
    mirrorText: topicCopy.mirrorText,
    visiblePattern: emotional.emotionalRhythm,
    closingLine: topicCopy.closingLine,
    sceneMetaphor: safeScene.sceneMetaphor,
    visualKeywords: safeScene.visualKeywords,
    safetyLevel,
  };
}

export { formatDateTr };
