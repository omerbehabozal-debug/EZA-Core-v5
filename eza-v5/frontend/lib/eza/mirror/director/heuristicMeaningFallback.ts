/**
 * Map heuristic conversationMeaningSummary → Mirror Director V1 schema.
 * Used when LLM analysis is unavailable, invalid, or low-confidence vs strong heuristic.
 */

import { buildConversationMeaningSummary } from '@/lib/eza/mirror/conversationMirrorV2/conversationMeaningSummary';
import type { ConversationMeaningSummary } from '@/lib/eza/mirror/conversationMirrorV2/conversationMeaningSummary';
import {
  HIGH_HEURISTIC_CONFIDENCE,
  LOW_CONFIDENCE_THRESHOLD,
  MIRROR_DIRECTOR_SCHEMA_VERSION,
  type MirrorDirectorPrimaryTopic,
  type MirrorMeaningAnalysisResult,
  type MirrorMeaningAnalysisV1,
  normalizeMirrorDirectorTopic,
  toStoryTopicId,
} from '@/lib/eza/mirror/director/mirrorDirectorTypes';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

const DEFAULT_FORBIDDEN_BY_TOPIC: Partial<Record<StoryTopicId, string[]>> = {
  travel: ['bathroom mirror', 'cosmetics', 'gym imagery', 'medical imagery', 'clinic'],
  architecture: ['bathroom mirror', 'cosmetics', 'gym imagery', 'medical imagery'],
  health: ['travel postcard collage', 'airport departure board'],
  general_curiosity: ['bathroom mirror', 'cosmetics', 'medical imagery'],
};

const DEFAULT_PALETTE_BY_TOPIC: Partial<Record<StoryTopicId, string[]>> = {
  travel: ['warm amber', 'deep indigo', 'rain silver'],
  architecture: ['stone grey', 'soft daylight', 'graphite'],
  health: ['soft ivory', 'quiet sage', 'morning light'],
  general_curiosity: ['soft gold', 'mist blue'],
};

export type MeaningResolutionSource =
  | 'llm'
  | 'heuristic_fallback'
  | 'heuristic_low_llm_confidence'
  | 'heuristic_deferred_conflict';

export type ResolvedMirrorMeaning = {
  analysis: MirrorMeaningAnalysisV1;
  /** Active topic for today's semantic-first pipeline (StoryTopicId). */
  storyTopicId: StoryTopicId;
  source: MeaningResolutionSource;
  /**
   * LLM and high-confidence heuristic disagreed under low LLM confidence.
   * PR B Director should decide; PR A keeps heuristic active.
   */
  deferredConflict: boolean;
  llmAnalysis: MirrorMeaningAnalysisV1 | null;
  heuristicAnalysis: MirrorMeaningAnalysisV1;
};

function defaultForbidden(topic: StoryTopicId): string[] {
  return DEFAULT_FORBIDDEN_BY_TOPIC[topic] ?? ['bathroom mirror', 'cosmetics', 'medical imagery'];
}

function defaultPalette(topic: StoryTopicId): string[] {
  return DEFAULT_PALETTE_BY_TOPIC[topic] ?? ['soft ambient light', 'neutral depth'];
}

function buildNarrative(meaning: ConversationMeaningSummary): string {
  const entityBit = meaning.entities.slice(0, 3).join(', ');
  const moodBit = meaning.visualMood.slice(0, 3).join(', ');
  if (entityBit && moodBit) {
    return `${entityBit}: ${meaning.userIntent.replace(/_/g, ' ')} — ${moodBit}.`;
  }
  if (entityBit) {
    return `${entityBit}: ${meaning.userIntent.replace(/_/g, ' ')}.`;
  }
  return meaning.userIntent.replace(/_/g, ' ');
}

function buildComposition(meaning: ConversationMeaningSummary): string {
  const mood = meaning.visualMood[0];
  if (meaning.primaryTopic === 'travel' && mood) {
    return `cinematic street-level scene with ${mood.replace(/_/g, ' ')} atmosphere`;
  }
  if (meaning.primaryTopic === 'architecture') {
    return 'clear urban spatial composition with walkways, edges, and human scale';
  }
  if (meaning.primaryTopic === 'health') {
    return 'quiet wellness atmosphere without clinical or cosmetic framing';
  }
  return 'editorial single-scene cover composition matching the conversation narrative';
}

/** Convert existing heuristic summary into Director schema shape. */
export function mapHeuristicMeaningToDirectorAnalysis(
  meaning: ConversationMeaningSummary
): MirrorMeaningAnalysisV1 {
  const primary: MirrorDirectorPrimaryTopic = meaning.primaryTopic;
  const secondary = [
    ...meaning.entities.slice(0, 6),
    ...meaning.secondaryTopics.filter((t) => t !== meaning.primaryTopic),
  ].slice(0, 8);

  return {
    schemaVersion: MIRROR_DIRECTOR_SCHEMA_VERSION,
    primaryTopic: primary,
    topicCategory: primary,
    secondaryTopics: secondary,
    userIntent: meaning.userIntent.replace(/_/g, ' '),
    emotionalTone: meaning.visualMood.length ? meaning.visualMood : ['curious', 'calm'],
    narrative: buildNarrative(meaning),
    visualMotifs: [
      ...meaning.entities.slice(0, 4),
      ...meaning.visualMood.map((m) => m.replace(/_/g, ' ')),
    ].slice(0, 8),
    forbiddenSymbols: defaultForbidden(meaning.primaryTopic),
    suggestedPalette: defaultPalette(meaning.primaryTopic),
    suggestedComposition: buildComposition(meaning),
    confidence: meaning.confidence,
  };
}

export function buildHeuristicDirectorAnalysis(input: {
  conversationTexts?: readonly string[];
  cueTokens?: readonly string[];
}): MirrorMeaningAnalysisV1 {
  return mapHeuristicMeaningToDirectorAnalysis(buildConversationMeaningSummary(input));
}

function topicsConflict(a: MirrorDirectorPrimaryTopic, b: MirrorDirectorPrimaryTopic): boolean {
  const left = toStoryTopicId(normalizeMirrorDirectorTopic(a));
  const right = toStoryTopicId(normalizeMirrorDirectorTopic(b));
  if (left === right) return false;
  if (left === 'general_curiosity' || right === 'general_curiosity') return false;
  return true;
}

/**
 * Resolve LLM analysis vs heuristic fallback without breaking semantic-first flow.
 * Not wired to production create path in PR A — unit-tested for PR B readiness.
 */
export function resolveMeaningAnalysisWithFallback(input: {
  llmResult: MirrorMeaningAnalysisResult | null;
  conversationTexts?: readonly string[];
  cueTokens?: readonly string[];
}): ResolvedMirrorMeaning {
  const heuristicAnalysis = buildHeuristicDirectorAnalysis({
    conversationTexts: input.conversationTexts,
    cueTokens: input.cueTokens,
  });

  const llm = input.llmResult;
  if (!llm || !llm.ok) {
    return {
      analysis: heuristicAnalysis,
      storyTopicId: toStoryTopicId(heuristicAnalysis.primaryTopic),
      source: 'heuristic_fallback',
      deferredConflict: false,
      llmAnalysis: null,
      heuristicAnalysis,
    };
  }

  const llmAnalysis = {
    ...llm.analysis,
    primaryTopic: normalizeMirrorDirectorTopic(llm.analysis.primaryTopic),
    topicCategory: normalizeMirrorDirectorTopic(
      llm.analysis.topicCategory || llm.analysis.primaryTopic
    ),
  };

  const lowLlm =
    Boolean(llm.belowConfidenceThreshold) ||
    llmAnalysis.confidence < LOW_CONFIDENCE_THRESHOLD;
  const strongHeuristic = heuristicAnalysis.confidence >= HIGH_HEURISTIC_CONFIDENCE;
  const conflict = topicsConflict(llmAnalysis.primaryTopic, heuristicAnalysis.primaryTopic);

  if (lowLlm && strongHeuristic && conflict) {
    // PR B Director decides; PR A keeps heuristic active so live semantic path stays safe.
    return {
      analysis: heuristicAnalysis,
      storyTopicId: toStoryTopicId(heuristicAnalysis.primaryTopic),
      source: 'heuristic_deferred_conflict',
      deferredConflict: true,
      llmAnalysis,
      heuristicAnalysis,
    };
  }

  if (lowLlm) {
    return {
      analysis: heuristicAnalysis,
      storyTopicId: toStoryTopicId(heuristicAnalysis.primaryTopic),
      source: 'heuristic_low_llm_confidence',
      deferredConflict: false,
      llmAnalysis,
      heuristicAnalysis,
    };
  }

  return {
    analysis: llmAnalysis,
    storyTopicId: toStoryTopicId(llmAnalysis.primaryTopic),
    source: 'llm',
    deferredConflict: false,
    llmAnalysis,
    heuristicAnalysis,
  };
}

/** Lightweight schema guard for untrusted JSON (frontend). */
export function parseMirrorMeaningAnalysisJson(
  raw: unknown
): MirrorMeaningAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'invalid_json', message: 'root is not an object' };
  }
  const data = raw as Record<string, unknown>;
  try {
    const primary = normalizeMirrorDirectorTopic(String(data.primaryTopic ?? ''));
    const topicCategory = normalizeMirrorDirectorTopic(
      String(data.topicCategory ?? data.primaryTopic ?? '')
    );
    const confidence = Number(data.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return { ok: false, code: 'schema_validation', message: 'invalid confidence' };
    }
    const userIntent = String(data.userIntent ?? '').trim();
    const narrative = String(data.narrative ?? '').trim();
    const suggestedComposition = String(data.suggestedComposition ?? '').trim();
    if (!userIntent || !narrative || !suggestedComposition) {
      return { ok: false, code: 'schema_validation', message: 'missing required string fields' };
    }
    const asList = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];

    const analysis: MirrorMeaningAnalysisV1 = {
      schemaVersion: MIRROR_DIRECTOR_SCHEMA_VERSION,
      primaryTopic: primary === 'other' ? topicCategory : primary,
      topicCategory: primary !== 'other' ? primary : topicCategory,
      secondaryTopics: asList(data.secondaryTopics),
      userIntent: userIntent.slice(0, 400),
      emotionalTone: asList(data.emotionalTone).slice(0, 8),
      narrative: narrative.slice(0, 800),
      visualMotifs: asList(data.visualMotifs),
      forbiddenSymbols: asList(data.forbiddenSymbols),
      suggestedPalette: asList(data.suggestedPalette).slice(0, 8),
      suggestedComposition: suggestedComposition.slice(0, 500),
      confidence,
    };
    return {
      ok: true,
      analysis,
      belowConfidenceThreshold: confidence < LOW_CONFIDENCE_THRESHOLD,
    };
  } catch {
    return { ok: false, code: 'schema_validation', message: 'schema parse failed' };
  }
}
