/**
 * V4.4 — simplified prompt quality heuristics.
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  containsForbiddenMirrorPhrase,
  FORBIDDEN_MIRROR_PHRASES,
} from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';
import { hasConversationSummaryLanguage } from '@/lib/eza/mirror/conversationMirrorV3/narrativeCopySanitizer';
import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';

export type ConversationMirrorV4QualityReport = {
  selectedTopic: string;
  conversationEvidence: ConversationEvidence[];
  heroScene: string;
  mirrorTitle: string;
  mirrorCopy: string;
  generatedPrompt: string;
  topicVisibilityScore: number;
  evidenceIntegrationScore: number;
  heroSceneScore: number;
  sceneSpecificityScore: number;
  cinematicScore: number;
  typographyContractScore: number;
  shareabilityScore: number;
};

const TARGET_SCORE = 8;

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function scoreTopicVisibility(
  evidence: readonly ConversationEvidence[],
  prompt: string
): number {
  let score = 5;
  if (evidence.length >= 3) score += 1.5;
  if (evidence.some((item) => item.role === 'primary')) score += 1;
  if (prompt.includes('Poster test:')) score += 1;
  if (prompt.includes('Evidence fusion scene')) score += 1;
  if (prompt.includes('within 3 seconds')) score += 0.5;
  if (prompt.includes('World Layer:')) score += 0.5;
  if (prompt.includes('Unified frame rule:')) score += 0.5;
  if (!prompt.includes('Narrative distance visual behavior')) score += 0.5;
  if (!prompt.includes('Emotional atmosphere:')) score += 0.5;
  return clampScore(score);
}

function scoreEvidenceIntegration(
  evidence: readonly ConversationEvidence[],
  prompt: string
): number {
  let score = 4;
  if (evidence.length >= 3 && evidence.length <= 7) score += 2;
  if (prompt.includes('Evidence fusion scene')) score += 2;
  if (prompt.includes('single frame, single environment')) score += 1;
  if (prompt.includes('World Layer:')) score += 1;
  if (prompt.includes('Unified frame rule:')) score += 1;
  if (prompt.includes('World Layer:')) score += 0.5;
  if (prompt.includes('Unified frame rule:')) score += 0.5;
  if (evidence.some((item) => item.role === 'secondary')) score += 0.5;
  return clampScore(score);
}

function scoreHeroScene(prompt: string, heroScene: string): number {
  let score = 4;
  if (heroScene.trim().length > 20) score += 1.5;
  if (prompt.includes('Evidence fusion scene')) score += 2;
  if (prompt.includes('Hero anchor:')) score += 1;
  if (prompt.includes('Fusion rule:')) score += 1;
  if (prompt.includes('World Layer:')) score += 1;
  if (prompt.includes('Unified frame rule:')) score += 1;
  if (prompt.includes('Forbidden visuals:')) score += 1;
  if (!prompt.includes('Meaning:')) score += 1;
  return clampScore(score);
}

function scoreSceneSpecificity(prompt: string): number {
  let score = 4;
  const markers = [
    'The topic itself is the story',
    'Do not transform the topic into a metaphor',
    'never an object catalog or moodboard',
    'Fusion rule: Evidence embedded',
  ];
  for (const marker of markers) {
    if (prompt.includes(marker)) score += 2;
  }
  return clampScore(score);
}

function scoreCinematic(prompt: string): number {
  let score = 4;
  if (prompt.includes('Visual style:')) score += 2;
  if (prompt.includes('Shot:')) score += 2;
  if (prompt.includes('Lighting:')) score += 2;
  if (!prompt.includes('Cinematography contract:')) score += 1;
  return clampScore(score);
}

function scoreTypography(prompt: string): number {
  let score = 4;
  const markers = ['Typography (10%)', 'Maximum 2 text zones', 'embed exactly'];
  for (const marker of markers) {
    if (prompt.includes(marker)) score += 2;
  }
  return clampScore(score);
}

function scoreShareability(
  payload: SainaMirrorV3Payload,
  evidence: readonly ConversationEvidence[],
  prompt: string
): number {
  let score = 4;
  if (payload.mirrorTitle.trim().length >= 3) score += 1;
  if (payload.mirrorText.trim().length >= 20) score += 1;
  if (!hasConversationSummaryLanguage(payload.mirrorText)) score += 1;
  if (!containsForbiddenMirrorPhrase(payload.mirrorTitle)) score += 0.5;
  if (evidence.length >= 3) score += 1;
  if (prompt.includes('conversation poster')) score += 0.5;
  if (
    !FORBIDDEN_MIRROR_PHRASES.some((phrase) =>
      prompt.toLowerCase().includes(phrase.toLowerCase())
    )
  ) {
    score += 1;
  }
  return clampScore(score);
}

export function buildConversationMirrorV4QualityReport(
  payload: SainaMirrorV3Payload,
  generatedPrompt: string
): ConversationMirrorV4QualityReport {
  const evidence = payload.conversationEvidence ?? [];
  const heroScene = payload.sceneComposition?.heroScene ?? payload.sceneMetaphor;

  return {
    selectedTopic: payload.selectedTopic,
    conversationEvidence: evidence,
    heroScene,
    mirrorTitle: payload.mirrorTitle,
    mirrorCopy: payload.mirrorText,
    generatedPrompt,
    topicVisibilityScore: scoreTopicVisibility(evidence, generatedPrompt),
    evidenceIntegrationScore: scoreEvidenceIntegration(evidence, generatedPrompt),
    heroSceneScore: scoreHeroScene(generatedPrompt, heroScene),
    sceneSpecificityScore: scoreSceneSpecificity(generatedPrompt),
    cinematicScore: scoreCinematic(generatedPrompt),
    typographyContractScore: scoreTypography(generatedPrompt),
    shareabilityScore: scoreShareability(payload, evidence, generatedPrompt),
  };
}

export function meetsConversationMirrorV4QualityTarget(
  report: ConversationMirrorV4QualityReport
): boolean {
  return (
    report.topicVisibilityScore >= TARGET_SCORE &&
    report.evidenceIntegrationScore >= TARGET_SCORE &&
    report.heroSceneScore >= TARGET_SCORE &&
    report.sceneSpecificityScore >= TARGET_SCORE &&
    report.typographyContractScore >= TARGET_SCORE &&
    report.shareabilityScore >= TARGET_SCORE
  );
}

export function shouldRegeneratePromptForTopicVisibility(
  report: ConversationMirrorV4QualityReport
): boolean {
  return report.topicVisibilityScore < TARGET_SCORE;
}

export const CONVERSATION_MIRROR_V4_TARGET_SCORE = TARGET_SCORE;

export type ConversationMirrorV33QualityReport = ConversationMirrorV4QualityReport;
export const buildConversationMirrorV33QualityReport = buildConversationMirrorV4QualityReport;
export const meetsConversationMirrorV33QualityTarget = meetsConversationMirrorV4QualityTarget;
export const CONVERSATION_MIRROR_V33_TARGET_SCORE = TARGET_SCORE;
