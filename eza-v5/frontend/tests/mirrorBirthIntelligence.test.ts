import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildConversationMirrorEntries,
  type ConversationMirrorMessage,
} from '@/lib/eza/mirror/conversationMirrorEntries';
import {
  MIRROR_BIRTH_INACTIVITY_MS,
  evaluateMirrorBirth,
  shouldShowMirrorBirthSuggestion,
} from '@/lib/eza/mirror-birth/mirrorBirthPolicy';
import {
  MIRROR_BIRTH_SUGGESTED_EVENT,
  MIRROR_BIRTH_DISMISSED_EVENT,
  MIRROR_BIRTH_ACCEPTED_EVENT,
  trackMirrorBirthSuggested,
  trackMirrorBirthDismissed,
  trackMirrorBirthAccepted,
} from '@/lib/eza/mirror-birth/mirrorBirthAnalytics';
import {
  clearMirrorBirthSession,
  isMirrorBirthShown,
  markMirrorBirthDismissed,
  markMirrorBirthMirrorCreated,
  markMirrorBirthShown,
} from '@/lib/eza/mirror-birth/mirrorBirthSession';
import {
  MIRROR_BIRTH_SUGGESTION_BODY,
  MIRROR_BIRTH_SUGGESTION_CTA,
  MIRROR_BIRTH_SUGGESTION_TITLE,
} from '@/lib/eza/mirror-birth/mirrorBirthCopy';
import { hasConversationMirrorArtifact } from '@/lib/eza/mirror-birth/mirrorBirthConversation';

function buildTurnPair(index: number, userText: string, assistantText: string): ConversationMirrorMessage[] {
  return [
    {
      id: `user-${index}`,
      text: userText,
      isUser: true,
      timestamp: new Date(),
    },
    {
      id: `assistant-${index}`,
      text: assistantText,
      isUser: false,
      timestamp: new Date(),
    },
  ];
}

function buildKyotoConversation(pairs: number): ConversationMirrorMessage[] {
  const messages: ConversationMirrorMessage[] = [];
  for (let i = 0; i < pairs; i += 1) {
    messages.push(
      ...buildTurnPair(
        i,
        `Kyoto sokak lambaları ve Japonya akşamları ${i}`,
        `Kyoto merkezinde yerel kafeler ve tapınak yolları ${i}`
      )
    );
  }
  return messages;
}

function baseInput(messages: ConversationMirrorMessage[], overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    messages,
    entries: buildConversationMirrorEntries(messages),
    assistantIsDone: true,
    isLoading: false,
    isTyping: false,
    dismissed: false,
    shownInSession: false,
    mirrorAlreadyCreated: false,
    lastAssistantDoneAt: now - MIRROR_BIRTH_INACTIVITY_MS - 500,
    now,
    ...overrides,
  };
}

describe('Mirror Birth Intelligence (Stage 4A)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('does not suggest with only 4 user turns', () => {
    const messages = buildKyotoConversation(4);
    const evaluation = evaluateMirrorBirth(baseInput(messages));
    expect(evaluation.ready).toBe(false);
    expect(shouldShowMirrorBirthSuggestion(baseInput(messages))).toBe(false);
    expect(evaluation.summary).toBe('Need more conversation');
  });

  it('suggests after 5 user turns, stable topic, and editorial pause', () => {
    const messages = buildKyotoConversation(5);
    expect(shouldShowMirrorBirthSuggestion(baseInput(messages))).toBe(true);
  });

  it('does not suggest while streaming', () => {
    const messages = buildKyotoConversation(5);
    expect(
      shouldShowMirrorBirthSuggestion(
        baseInput(messages, { isLoading: true, assistantIsDone: false })
      )
    ).toBe(false);
    expect(
      shouldShowMirrorBirthSuggestion(baseInput(messages, { isTyping: true, assistantIsDone: false }))
    ).toBe(false);
  });

  it('does not suggest again after dismiss', () => {
    const messages = buildKyotoConversation(5);
    markMirrorBirthShown('chat-1');
    markMirrorBirthDismissed('chat-1');
    expect(
      shouldShowMirrorBirthSuggestion(
        baseInput(messages, { dismissed: true, shownInSession: true })
      )
    ).toBe(false);
  });

  it('hides suggestion after mirror is created for conversation', () => {
    const messages = buildKyotoConversation(5);
    markMirrorBirthMirrorCreated('chat-2');
    expect(hasConversationMirrorArtifact('chat-2')).toBe(true);
    expect(
      shouldShowMirrorBirthSuggestion(baseInput(messages, { mirrorAlreadyCreated: true }))
    ).toBe(false);
  });

  it('blocks suggestion when safety layer is not normal', () => {
    const messages = [
      ...buildKyotoConversation(4),
      ...buildTurnPair(99, 'intihar düşünceleri hakkında konuşalım', 'Sana destek olmak isterim'),
    ];
    const evaluation = evaluateMirrorBirth(baseInput(messages));
    expect(evaluation.reasons.safetyPassed).toBe(false);
    expect(shouldShowMirrorBirthSuggestion(baseInput(messages))).toBe(false);
  });

  it('emits analytics events for suggest, dismiss, and accept', () => {
    const suggested = vi.fn();
    const dismissed = vi.fn();
    const accepted = vi.fn();

    window.addEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, suggested);
    window.addEventListener(MIRROR_BIRTH_DISMISSED_EVENT, dismissed);
    window.addEventListener(MIRROR_BIRTH_ACCEPTED_EVENT, accepted);

    trackMirrorBirthSuggested('chat-analytics');
    trackMirrorBirthDismissed('chat-analytics');
    trackMirrorBirthAccepted('chat-analytics');

    expect(suggested).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(accepted).toHaveBeenCalledTimes(1);

    window.removeEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, suggested);
    window.removeEventListener(MIRROR_BIRTH_DISMISSED_EVENT, dismissed);
    window.removeEventListener(MIRROR_BIRTH_ACCEPTED_EVENT, accepted);
  });

  it('tracks shown-once per session', () => {
    markMirrorBirthShown('chat-session');
    expect(isMirrorBirthShown('chat-session')).toBe(true);
    clearMirrorBirthSession('chat-session');
    expect(isMirrorBirthShown('chat-session')).toBe(false);
  });

  it('uses editorial copy without forbidden product language', () => {
    const blob = `${MIRROR_BIRTH_SUGGESTION_TITLE} ${MIRROR_BIRTH_SUGGESTION_BODY} ${MIRROR_BIRTH_SUGGESTION_CTA}`.toLowerCase();
    expect(blob).not.toContain('koleksiyon');
    expect(blob).not.toContain('paylaş');
    expect(blob).not.toContain('tamamlandı');
    expect(blob).not.toContain('başarı');
    expect(MIRROR_BIRTH_SUGGESTION_CTA).toBe('Mirror oluştur');
  });
});
