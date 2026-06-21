/**
 * V3.3 — deterministic quality heuristics for prompt + payload review.
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  containsForbiddenMirrorPhrase,
  FORBIDDEN_MIRROR_PHRASES,
} from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';
import { hasConversationSummaryLanguage } from '@/lib/eza/mirror/conversationMirrorV3/narrativeCopySanitizer';
import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';

export type ConversationMirrorV33QualityReport = {
  selectedTopic: string;
  conversationEvidence: ConversationEvidence[];
  mirrorTitle: string;
  mirrorCopy: string;
  generatedPrompt: string;
  topicVisibilityScore: number;
  evidenceIntegrationScore: number;
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
  if (prompt.includes('Topic visibility rule:')) score += 1;
  if (prompt.includes('Conversation evidence:')) score += 1;
  if (prompt.includes('within 3 seconds')) score += 0.5;
  return clampScore(score);
}

function scoreEvidenceIntegration(
  evidence: readonly ConversationEvidence[],
  prompt: string
): number {
  let score = 4;
  if (evidence.length >= 3 && evidence.length <= 6) score += 2;
  if (evidence.filter((item) => item.visualHint.trim().length > 12).length >= 3) score += 1.5;
  if (prompt.includes('Evidence weight:')) score += 1;
  if (prompt.includes('Integrate them naturally')) score += 1;
  if (evidence.some((item) => item.role === 'secondary')) score += 0.5;
  return clampScore(score);
}

function scoreCinematic(prompt: string): number {
  let score = 4;
  const markers = [
    'Cinematography contract:',
    'Lighting recipe:',
    'Shot mode (',
    'Reference tier:',
    'Scene clarity rule:',
    'Season art direction:',
  ];
  for (const marker of markers) {
    if (prompt.includes(marker)) score += 1;
  }
  return clampScore(score);
}

function scoreTypography(prompt: string): number {
  let score = 4;
  const markers = [
    'Typography director:',
    'Typography grid:',
    'OpenAI poster text contract:',
    'Text zone should occupy 20–30%',
    'Forbidden text elements:',
  ];
  for (const marker of markers) {
    if (prompt.includes(marker)) score += 1.2;
  }
  return clampScore(score);
}

function scoreShareability(
  payload: SainaMirrorV3Payload,
  evidence: readonly ConversationEvidence[],
  prompt: string
): number {
  let score = 4;
  if (payload.mirrorTitle.trim().length >= 8) score += 1;
  if (payload.mirrorText.trim().length >= 20) score += 1;
  if (!hasConversationSummaryLanguage(payload.mirrorText)) score += 1;
  if (!containsForbiddenMirrorPhrase(payload.mirrorTitle)) score += 0.5;
  if (evidence.length >= 3) score += 1;
  if (prompt.includes('Abstraction limit:')) score += 0.5;
  if (
    !FORBIDDEN_MIRROR_PHRASES.some((phrase) =>
      prompt.toLowerCase().includes(phrase.toLowerCase())
    )
  ) {
    score += 1;
  }
  return clampScore(score);
}

export function buildConversationMirrorV33QualityReport(
  payload: SainaMirrorV3Payload,
  generatedPrompt: string
): ConversationMirrorV33QualityReport {
  const evidence = payload.conversationEvidence ?? [];

  const topicVisibilityScore = scoreTopicVisibility(evidence, generatedPrompt);
  const evidenceIntegrationScore = scoreEvidenceIntegration(evidence, generatedPrompt);
  const cinematicScore = scoreCinematic(generatedPrompt);
  const typographyContractScore = scoreTypography(generatedPrompt);
  const shareabilityScore = scoreShareability(payload, evidence, generatedPrompt);

  return {
    selectedTopic: payload.selectedTopic,
    conversationEvidence: evidence,
    mirrorTitle: payload.mirrorTitle,
    mirrorCopy: payload.mirrorText,
    generatedPrompt,
    topicVisibilityScore,
    evidenceIntegrationScore,
    cinematicScore,
    typographyContractScore,
    shareabilityScore,
  };
}

export function meetsConversationMirrorV33QualityTarget(
  report: ConversationMirrorV33QualityReport
): boolean {
  return (
    report.topicVisibilityScore >= TARGET_SCORE &&
    report.evidenceIntegrationScore >= TARGET_SCORE &&
    report.typographyContractScore >= TARGET_SCORE &&
    report.shareabilityScore >= TARGET_SCORE
  );
}

export const CONVERSATION_MIRROR_V33_TARGET_SCORE = TARGET_SCORE;
