/**
 * Mirror Birth Intelligence — deterministic research-completion gate (Stage 4A V1).
 */

import { assessMirrorSafetyFromTexts, assessMirrorSafetyLevel } from '@/lib/eza/mirror/conversationMirrorV2/safetyFilter';
import type { ConversationMirrorMessage } from '@/lib/eza/mirror/conversationMirrorEntries';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { areLastMessagesOnSameTopicAxis } from '@/lib/eza/mirror-birth/mirrorBirthTopicStability';

export const MIRROR_BIRTH_MIN_USER_MESSAGES = 5;
export const MIRROR_BIRTH_MIN_ASSISTANT_MESSAGES = 5;
export const MIRROR_BIRTH_INACTIVITY_MS = 10_000;

export type MirrorBirthReasonFlags = {
  minUserMessages: boolean;
  minAssistantMessages: boolean;
  lastMessageAssistant: boolean;
  notStreaming: boolean;
  topicStable: boolean;
  safetyPassed: boolean;
  recommendationNotShownBefore: boolean;
  notDismissed: boolean;
  mirrorNotCreated: boolean;
  inactivityElapsed: boolean;
};

export type MirrorBirthEvaluation = {
  ready: boolean;
  reasons: MirrorBirthReasonFlags;
  userMessageCount: number;
  assistantMessageCount: number;
  summary: string;
  detailLines: string[];
};

export type MirrorBirthEvaluateInput = {
  messages: ConversationMirrorMessage[];
  entries: SavedBehavioralEntry[];
  assistantIsDone: boolean;
  isLoading: boolean;
  isTyping: boolean;
  dismissed: boolean;
  shownInSession: boolean;
  mirrorAlreadyCreated: boolean;
  lastAssistantDoneAt?: number | null;
  now?: number;
};

function countMessages(messages: ConversationMirrorMessage[]) {
  const userMessageCount = messages.filter((m) => m.isUser && m.text.trim()).length;
  const assistantMessageCount = messages.filter((m) => !m.isUser && m.text.trim()).length;
  return { userMessageCount, assistantMessageCount };
}

function isLastMessageAssistant(messages: ConversationMirrorMessage[]): boolean {
  const last = [...messages].reverse().find((m) => m.text.trim());
  return Boolean(last && !last.isUser);
}

function buildDetailLines(flags: MirrorBirthReasonFlags): string[] {
  const lines: string[] = [];
  if (flags.minUserMessages) lines.push('Minimum messages reached');
  if (flags.minAssistantMessages) lines.push('Assistant responses sufficient');
  if (flags.lastMessageAssistant) lines.push('Last turn completed by assistant');
  if (flags.notStreaming) lines.push('Streaming idle');
  if (flags.topicStable) lines.push('Topic stable');
  if (flags.safetyPassed) lines.push('Safety passed');
  if (flags.recommendationNotShownBefore) lines.push('Recommendation not shown before');
  if (flags.notDismissed) lines.push('Not dismissed');
  if (flags.mirrorNotCreated) lines.push('Mirror not created yet');
  if (flags.inactivityElapsed) lines.push('Editorial pause elapsed');
  return lines;
}

export function evaluateMirrorBirth(input: MirrorBirthEvaluateInput): MirrorBirthEvaluation {
  const { userMessageCount, assistantMessageCount } = countMessages(input.messages);
  const lastMessageAssistant = isLastMessageAssistant(input.messages);
  const notStreaming = input.assistantIsDone && !input.isLoading && !input.isTyping;
  const topicStable = areLastMessagesOnSameTopicAxis(input.messages);
  const userTexts = input.messages.filter((m) => m.isUser && m.text.trim()).map((m) => m.text);
  const safetyPassed =
    assessMirrorSafetyLevel(input.entries) === 'normal' &&
    assessMirrorSafetyFromTexts(userTexts) === 'normal';

  const now = input.now ?? Date.now();
  const inactivityElapsed = Boolean(
    input.lastAssistantDoneAt != null &&
      now - input.lastAssistantDoneAt >= MIRROR_BIRTH_INACTIVITY_MS
  );

  const reasons: MirrorBirthReasonFlags = {
    minUserMessages: userMessageCount >= MIRROR_BIRTH_MIN_USER_MESSAGES,
    minAssistantMessages: assistantMessageCount >= MIRROR_BIRTH_MIN_ASSISTANT_MESSAGES,
    lastMessageAssistant,
    notStreaming,
    topicStable,
    safetyPassed,
    recommendationNotShownBefore: !input.shownInSession,
    notDismissed: !input.dismissed,
    mirrorNotCreated: !input.mirrorAlreadyCreated,
    inactivityElapsed,
  };

  const coreReady =
    reasons.minUserMessages &&
    reasons.minAssistantMessages &&
    reasons.lastMessageAssistant &&
    reasons.notStreaming &&
    reasons.topicStable &&
    reasons.safetyPassed &&
    reasons.recommendationNotShownBefore &&
    reasons.notDismissed &&
    reasons.mirrorNotCreated;

  const ready = coreReady && reasons.inactivityElapsed;

  let summary = 'Ready';
  if (!reasons.minUserMessages || !reasons.minAssistantMessages) {
    summary = 'Need more conversation';
  } else if (!reasons.safetyPassed) {
    summary = 'Safety blocked';
  } else if (!reasons.topicStable) {
    summary = 'Topic not stable yet';
  } else if (!reasons.notStreaming) {
    summary = 'Assistant still responding';
  } else if (!reasons.inactivityElapsed) {
    summary = 'Waiting for editorial pause';
  } else if (!ready) {
    summary = 'Not ready';
  }

  return {
    ready,
    reasons,
    userMessageCount,
    assistantMessageCount,
    summary,
    detailLines: buildDetailLines(reasons),
  };
}

export function shouldShowMirrorBirthSuggestion(input: MirrorBirthEvaluateInput): boolean {
  return evaluateMirrorBirth(input).ready;
}
