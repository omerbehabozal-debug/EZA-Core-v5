/**
 * Phase 4.2 — bind interaction-level EZA to selected Journey steps at publish.
 *
 * Source: the exact chat turn (assistant message id → scores + BehavioralSnapshot).
 * Never uses Relationship Map / aggregate user EZA profile.
 */

import type { BehavioralSnapshot } from '@/lib/types';
import {
  readBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';
import type { ArchivedChatMessage } from '@/lib/standaloneChatArchive';
import { getChatArchive } from '@/lib/standaloneChatArchive';

export type FrozenStepEzaSnapshotInput = {
  assistantScore?: number | null;
  userScore?: number | null;
  behavioral?: BehavioralSnapshot | null;
};

export type JourneyPublishStepWithOptionalEza = {
  stepIndex: number;
  sourceOrder: number;
  sourceUserMessageId: string;
  sourceAssistantMessageId: string;
  publicQuestion: string;
  publicAnswer: string;
  ezaSnapshot?: FrozenStepEzaSnapshotInput | null;
};

type MessageLike = {
  id: string;
  isUser?: boolean;
  userScore?: number | null;
  assistantScore?: number | null;
  behavioral?: BehavioralSnapshot | null;
};

function asScore(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function findBehavioralByAssistantId(
  assistantMessageId: string,
  history: SavedBehavioralEntry[]
): BehavioralSnapshot | null {
  const id = assistantMessageId.trim();
  if (!id) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    if (row?.interaction_id === id) {
      return row;
    }
  }
  return null;
}

function resolveEzaForAssistant(input: {
  assistantMessageId: string;
  userMessageId: string;
  messagesById: Map<string, MessageLike>;
  history: SavedBehavioralEntry[];
}): FrozenStepEzaSnapshotInput | null {
  const assistantId = input.assistantMessageId.trim();
  const userId = input.userMessageId.trim();
  if (!assistantId) return null;

  const assistantMsg = input.messagesById.get(assistantId);
  const userMsg = userId ? input.messagesById.get(userId) : undefined;

  const behavioral =
    assistantMsg?.behavioral ||
    userMsg?.behavioral ||
    findBehavioralByAssistantId(assistantId, input.history) ||
    null;

  const assistantScore =
    asScore(assistantMsg?.assistantScore) ??
    asScore(behavioral?.vector?.eza_final) ??
    null;
  const userScore =
    asScore(userMsg?.userScore) ?? asScore(assistantMsg?.userScore) ?? null;

  if (assistantScore == null && userScore == null && !behavioral) {
    return null;
  }

  return {
    ...(assistantScore != null ? { assistantScore } : {}),
    ...(userScore != null ? { userScore } : {}),
    ...(behavioral ? { behavioral } : {}),
  };
}

/**
 * Attach per-step EZA snapshots from conversation messages / behavioral history.
 * Does not invent scores. Missing EZA → omit field.
 */
export function attachEzaSnapshotsToSelectedSteps<
  T extends {
    stepIndex: number;
    sourceOrder: number;
    sourceUserMessageId: string;
    sourceAssistantMessageId: string;
    publicQuestion: string;
    publicAnswer: string;
    ezaSnapshot?: FrozenStepEzaSnapshotInput | null;
  },
>(
  steps: T[],
  options?: {
    conversationId?: string | null;
    messages?: MessageLike[] | ArchivedChatMessage[] | null;
  }
): T[] {
  const messagesById = new Map<string, MessageLike>();
  const fromOpts = options?.messages || [];
  for (const msg of fromOpts) {
    if (msg?.id) messagesById.set(String(msg.id), msg as MessageLike);
  }
  const conversationId = (options?.conversationId || '').trim();
  if (conversationId && messagesById.size === 0) {
    const archived = getChatArchive(conversationId);
    for (const msg of archived?.messages || []) {
      if (msg?.id) messagesById.set(String(msg.id), msg as MessageLike);
    }
  }
  const history = readBehavioralHistory();

  return steps.map((step) => {
    if (step.ezaSnapshot) {
      return step;
    }
    const ezaSnapshot = resolveEzaForAssistant({
      assistantMessageId: step.sourceAssistantMessageId,
      userMessageId: step.sourceUserMessageId,
      messagesById,
      history,
    });
    if (!ezaSnapshot) return step;
    return { ...step, ezaSnapshot };
  });
}
