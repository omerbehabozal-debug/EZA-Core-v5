/**
 * Build mirror entries from the active chat session (not only localStorage history).
 */

import {
  appendBehavioralTurn,
  type SavedBehavioralEntry,
  isValidBehavioralEntry,
} from '@/lib/behavioralHistory';
import { extractStoryCueTokens } from '@/lib/eza/mirror/storyTopicResolver';
import type { BehavioralSnapshot, StandaloneObservation } from '@/lib/types';

export type ConversationMirrorMessage = {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  timestamp?: Date;
  behavioral?: BehavioralSnapshot | null;
  standaloneObservation?: StandaloneObservation | null;
};

function scoreToRisk(score: number | undefined, fallback: number): number {
  if (score === undefined || Number.isNaN(score)) return fallback;
  const clamped = Math.max(0, Math.min(100, score));
  return Math.max(0.05, Math.min(0.95, (100 - clamped) / 100));
}

export function buildScoreBasedSnapshot(params: {
  interactionId: string;
  userScore?: number;
  assistantScore?: number;
}): BehavioralSnapshot {
  const inputRisk = scoreToRisk(params.userScore, 0.28);
  const outputRisk = scoreToRisk(params.assistantScore, 0.22);
  const inputHealth = 1 - inputRisk;
  const outputHealth = 1 - outputRisk;
  const eza =
    params.assistantScore !== undefined
      ? params.assistantScore
      : params.userScore !== undefined
        ? params.userScore
        : null;

  return {
    schema_version: 1,
    interaction_id: params.interactionId,
    mode: 'standalone',
    vector: {
      input_risk: inputRisk,
      output_risk: outputRisk,
      input_health: inputHealth,
      output_health: outputHealth,
      alignment_score:
        params.userScore !== undefined && params.assistantScore !== undefined
          ? Math.max(0, Math.min(100, (params.userScore + params.assistantScore) / 2))
          : null,
      eza_final: eza,
      intent: '',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: {
      health_gap: outputHealth - inputHealth,
      risk_delta_output_minus_input: outputRisk - inputRisk,
      index: Math.abs(outputRisk - inputRisk),
    },
  };
}

/** One entry per completed assistant turn in the active chat. */
export function buildConversationMirrorEntries(
  messages: ConversationMirrorMessage[]
): SavedBehavioralEntry[] {
  const entries: SavedBehavioralEntry[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i]!;
    if (msg.isUser || !msg.text.trim()) continue;

    let userMsg: ConversationMirrorMessage | undefined;
    for (let j = i - 1; j >= 0; j -= 1) {
      const candidate = messages[j]!;
      if (candidate.isUser && candidate.text.trim()) {
        userMsg = candidate;
        break;
      }
    }

    const snapshot =
      msg.behavioral ??
      buildScoreBasedSnapshot({
        interactionId: `chat-${msg.id}`,
        userScore: userMsg?.userScore,
        assistantScore: msg.assistantScore,
      });

    const observation = msg.standaloneObservation ?? null;
    const mirrorCueHints = userMsg?.text
      ? extractStoryCueTokens(userMsg.text)
      : undefined;

    entries.push({
      ...snapshot,
      savedAt: (msg.timestamp ?? new Date()).toISOString(),
      ...(observation ? { standaloneObservation: observation } : {}),
      ...(mirrorCueHints?.length ? { mirrorCueHints } : {}),
    });
  }

  return entries.filter(isValidBehavioralEntry);
}

export function persistChatTurnFromResponse(params: {
  userText: string;
  interactionId: string;
  behavioral?: BehavioralSnapshot | null;
  standaloneObservation?: StandaloneObservation | null;
  userScore?: number;
  assistantScore?: number;
}): void {
  const hasSignal =
    params.behavioral != null ||
    params.standaloneObservation != null ||
    params.userScore !== undefined ||
    params.assistantScore !== undefined;
  if (!hasSignal) return;

  const snapshot =
    params.behavioral ??
    buildScoreBasedSnapshot({
      interactionId: params.interactionId,
      userScore: params.userScore,
      assistantScore: params.assistantScore,
    });
  const mirrorCueHints = extractStoryCueTokens(params.userText);
  appendBehavioralTurn(snapshot, params.standaloneObservation, {
    mirrorCueHints: mirrorCueHints.length ? mirrorCueHints : undefined,
  });
}
