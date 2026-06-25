/**
 * SAINA Mirror Philosophy — see @/lib/eza/mirror-network/philosophy.ts
 *
 * Stage 0 debug: Curiosity Seed Intelligence vs minimal image prompt vs landing pipeline.
 */

import type { MirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import { buildOpenAIRenderPromptFromPayload } from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import {
  auditMirrorProviderPrompt,
  buildMirrorProviderPrompt,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorProviderPromptBuilder';
import { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorCuriosityBundle } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import { auditMirrorImagePromptLeakage } from '@/lib/eza/mirror-network/auditImagePrompt';
import {
  CURIOSITY_SEED_INTELLIGENCE_LABEL,
  evaluateMirrorPhilosophyCheck,
  formatMirrorPhilosophyCheck,
  MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT,
  type MirrorPhilosophyCheck,
} from '@/lib/eza/mirror-network/philosophy';
import type { MirrorImagePromptLeakageAudit, MirrorSeed } from '@/lib/eza/mirror-network/types';

export type MirrorIntelligenceDebugOutput = {
  intelligenceLabel: string;
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

export type MirrorStage0DebugOutput = {
  cardTitle: string;
  coreCuriosity: string;
  seed: MirrorSeed;
  /** @deprecated Use seed */
  topicDNA: MirrorSeed;
  curiosityContext: string;
  finalMinimalImagePrompt: string;
  moodInImagePrompt: boolean;
  promptLeakage: MirrorImagePromptLeakageAudit;
  philosophy: MirrorPhilosophyCheck;
};

export type MirrorOpenAIRenderDebugOutput = {
  frontendMinimalPrompt: string;
  backendProviderPrompt: string;
  promptLength: number;
  providerPromptLength: number;
  withinLimit: boolean;
  promptSameAsFrontend: boolean;
  backendAppendApplied: boolean;
  backendAppendedSections: string[];
  containsLegacyAvoid: boolean;
  containsQualityBlock: boolean;
  containsStyleBlock: boolean;
  rawConversationSent: false;
  fullSummarySent: false;
  evidenceListSent: false;
  seedQuestionsSent: false;
  bodyOnPoster: false;
  topicHintInPrompt: false;
  visualDirectionInPrompt: false;
};

export type MirrorV5RenderDebugTrace = {
  intelligence: MirrorIntelligenceDebugOutput;
  stage0: MirrorStage0DebugOutput;
  render: MirrorOpenAIRenderDebugOutput;
};

export function buildMirrorV5RenderDebugTrace(
  payload: SainaMirrorV3Payload
): MirrorV5RenderDebugTrace {
  const brief = buildMirrorRenderBrief(payload);
  const bundle = payload.curiosityBundle ?? buildMirrorCuriosityBundle(payload);
  const { prompt, promptLength, withinLimit } = buildOpenAIRenderPromptFromPayload(brief);
  const visual = buildVisualPayloadFromMirrorV3(payload);
  const audit = auditMirrorProviderPrompt(visual);
  const providerPrompt = buildMirrorProviderPrompt(visual);
  const leakage = auditMirrorImagePromptLeakage(prompt, payload, brief, bundle);
  const philosophy = evaluateMirrorPhilosophyCheck({
    cardTitle: bundle.cardTitle,
    coreCuriosity: bundle.coreCuriosity,
    mirrorBodyOnCard: false,
    promptLeakagePassed: leakage.passed,
  });

  return {
    intelligence: buildIntelligenceDebug(payload, brief),
    stage0: {
      cardTitle: bundle.cardTitle,
      coreCuriosity: bundle.coreCuriosity,
      seed: bundle.seed,
      topicDNA: bundle.seed,
      curiosityContext: bundle.curiosityContext.text,
      finalMinimalImagePrompt: prompt,
      moodInImagePrompt: MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT,
      promptLeakage: leakage,
      philosophy,
    },
    render: {
      frontendMinimalPrompt: prompt,
      backendProviderPrompt: providerPrompt,
      promptLength,
      providerPromptLength: audit.providerPromptLength,
      withinLimit,
      promptSameAsFrontend: audit.promptSameAsFrontend,
      backendAppendApplied: audit.backendAppendApplied,
      backendAppendedSections: audit.backendAppendedSections,
      containsLegacyAvoid: audit.containsLegacyAvoid,
      containsQualityBlock: audit.containsQualityBlock,
      containsStyleBlock: audit.containsStyleBlock,
      rawConversationSent: false,
      fullSummarySent: false,
      evidenceListSent: false,
      seedQuestionsSent: false,
      bodyOnPoster: false,
      topicHintInPrompt: false,
      visualDirectionInPrompt: false,
    },
  };
}

function buildIntelligenceDebug(
  payload: SainaMirrorV3Payload,
  brief: MirrorRenderBrief
): MirrorIntelligenceDebugOutput {
  return {
    intelligenceLabel: CURIOSITY_SEED_INTELLIGENCE_LABEL,
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
  const s = trace.stage0;
  const r = trace.render;
  const l = s.promptLeakage;
  return [
    `=== A) ${i.intelligenceLabel} (private / landing prep) ===`,
    `selectedTopic: ${i.selectedTopic}`,
    `topicCategory: ${i.topicCategory}`,
    `mood: ${i.mood ?? '—'}`,
    `publicTopicHint (intelligence only): ${i.publicTopicHint}`,
    `visualDirection (intelligence only): ${i.visualDirection}`,
    `lightMode: ${i.lightMode}`,
    `safetyMode: ${i.safetyMode}`,
    `body (NOT on card): ${i.body}`,
    `evidence: ${i.evidenceLabels.join(', ') || '—'}`,
    '',
    '=== B) Stage 0 — Card vs Landing vs Image ===',
    formatMirrorPhilosophyCheck(s.philosophy),
    '',
    `cardTitle: ${s.cardTitle}`,
    `coreCuriosity (landing/discovery only): ${s.coreCuriosity}`,
    `curiosityContext (landing only): ${s.curiosityContext}`,
    `seed.subtopics: ${s.seed.subtopics.join(', ') || '—'}`,
    `seedQuestions (landing only): ${s.seed.seedQuestions.join(' | ') || '—'}`,
    `moodInImagePrompt: ${s.moodInImagePrompt}`,
    `promptLeakage.passed: ${l.passed}`,
    `  mirrorBodyInPrompt: ${l.mirrorBodyInPrompt}`,
    `  coreCuriosityInPrompt: ${l.coreCuriosityInPrompt}`,
    `  curiosityContextInPrompt: ${l.curiosityContextInPrompt}`,
    `  seedQuestionsInPrompt: ${l.seedQuestionsInPrompt}`,
    `  conversationSummaryInPrompt: ${l.conversationSummaryInPrompt}`,
    `  emailInPrompt: ${l.emailInPrompt}`,
    `  phoneInPrompt: ${l.phoneInPrompt}`,
    `  personalEntityInPrompt: ${l.personalEntityInPrompt}`,
    `  topicHintInPrompt: ${l.topicHintInPrompt}`,
    `  visualDirectionInPrompt: ${l.visualDirectionInPrompt}`,
  ].join('\n').concat(
    '\n\n=== C) Minimal Image Prompt ===\n',
    `promptLength: ${r.promptLength}`,
    `withinLimit (≤1400): ${r.withinLimit}`,
    `promptSameAsFrontend: ${r.promptSameAsFrontend}`,
    '\n\n--- Final Minimal Image Prompt ---\n',
    s.finalMinimalImagePrompt,
    '\n\n--- Provider Final Prompt ---\n',
    r.backendProviderPrompt
  );
}
