/**
 * V5 — debug trace: Intelligence vs OpenAI Render Layer.
 */

import type { MirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import { buildOpenAIRenderPromptFromPayload } from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';

export type MirrorIntelligenceDebugOutput = {
  selectedTopic: string;
  topicCategory: string;
  mood?: string;
  publicTopicHint: string;
  visualDirection: string;
  lightMode: string;
  safetyMode: string;
  title: string;
  body: string;
  evidenceLabels: string[];
  narrativeTheme: string;
  emotionalAtmosphere: string;
};

export type MirrorOpenAIRenderDebugOutput = {
  finalMinimalPrompt: string;
  promptLength: number;
  withinLimit: boolean;
  rawConversationSent: false;
  fullSummarySent: false;
  evidenceListSent: false;
  seedQuestionsSent: false;
  bodyOnPoster: false;
};

export type MirrorV5RenderDebugTrace = {
  intelligence: MirrorIntelligenceDebugOutput;
  render: MirrorOpenAIRenderDebugOutput;
};

export function buildMirrorV5RenderDebugTrace(
  payload: SainaMirrorV3Payload
): MirrorV5RenderDebugTrace {
  const brief = buildMirrorRenderBrief(payload);
  const { prompt, promptLength, withinLimit } = buildOpenAIRenderPromptFromPayload(brief);

  return {
    intelligence: buildIntelligenceDebug(payload, brief),
    render: {
      finalMinimalPrompt: prompt,
      promptLength,
      withinLimit,
      rawConversationSent: false,
      fullSummarySent: false,
      evidenceListSent: false,
      seedQuestionsSent: false,
      bodyOnPoster: false,
    },
  };
}

function buildIntelligenceDebug(
  payload: SainaMirrorV3Payload,
  brief: MirrorRenderBrief
): MirrorIntelligenceDebugOutput {
  return {
    selectedTopic: payload.selectedTopic,
    topicCategory: brief.topicCategory,
    mood: brief.mood,
    publicTopicHint: brief.publicTopicHint,
    visualDirection: brief.visualDirection,
    lightMode: brief.lightMode,
    safetyMode: brief.safetyMode,
    title: brief.title,
    body: payload.mirrorText,
    evidenceLabels: (payload.conversationEvidence ?? []).map((item) => item.label),
    narrativeTheme: payload.narrativeTheme,
    emotionalAtmosphere: payload.emotionalAtmosphere,
  };
}

export function formatMirrorV5RenderDebugTrace(trace: MirrorV5RenderDebugTrace): string {
  const i = trace.intelligence;
  const r = trace.render;
  return [
    '=== A) Mirror Intelligence Output ===',
    `selectedTopic: ${i.selectedTopic}`,
    `topicCategory: ${i.topicCategory}`,
    `mood: ${i.mood ?? '—'}`,
    `publicTopicHint: ${i.publicTopicHint}`,
    `visualDirection: ${i.visualDirection}`,
    `lightMode: ${i.lightMode}`,
    `safetyMode: ${i.safetyMode}`,
    `title: ${i.title}`,
    `body (landing only): ${i.body}`,
    `evidence: ${i.evidenceLabels.join(', ') || '—'}`,
  ].join('\n').concat(
    '\n\n=== B) OpenAI Render Prompt ===\n',
    `promptLength: ${r.promptLength}`,
    `withinLimit (≤1400): ${r.withinLimit}`,
    `rawConversationSent: ${r.rawConversationSent}`,
    `fullSummarySent: ${r.fullSummarySent}`,
    `evidenceListSent: ${r.evidenceListSent}`,
    `seedQuestionsSent: ${r.seedQuestionsSent}`,
    `bodyOnPoster: ${r.bodyOnPoster}`,
    '\n\n',
    r.finalMinimalPrompt
  );
}
