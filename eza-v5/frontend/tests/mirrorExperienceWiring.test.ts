/**
 * Experience wiring integration — same helpers StandaloneObservationExperience uses.
 * Proves archive + live merge → V3 meaning without mounting the full React tree.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildConversationMirrorState } from '@/lib/eza/mirror/buildConversationMirrorState';
import {
  clearActiveConversationLiveMessages,
  getActiveConversationLiveMessages,
  setActiveConversationLiveMessages,
} from '@/lib/eza/mirror/activeConversationLiveMessages';
import {
  collectConversationTextsForMirror,
  HEURISTIC_CONVERSATION_TEXTS_MAX_CHARS,
  resolveMirrorBuildConversationTexts,
} from '@/lib/eza/mirror/collectConversationTextsForMirror';
import {
  createStandaloneChat,
  getChatArchive,
  saveStandaloneChat,
  type ArchivedChatMessage,
} from '@/lib/standaloneChatArchive';

function makeEntry(id: string, hints: string[], savedAtOffset = 0): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date(Date.now() + savedAtOffset).toISOString(),
    mirrorCueHints: hints,
    vector: {
      input_risk: 0.2,
      output_risk: 0.15,
      input_health: 0.8,
      output_health: 0.85,
      alignment_score: 72,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: {
      health_gap: 0.05,
      risk_delta_output_minus_input: -0.05,
      index: 0.1,
    },
  };
}

function enoughEntries(hints: string[][]): SavedBehavioralEntry[] {
  return hints.map((h, i) => makeEntry(String(i + 1), h, i * 1000));
}

function experienceResolveTexts(conversationId: string) {
  // Mirrors StandaloneObservationExperience conversationTexts useMemo.
  return resolveMirrorBuildConversationTexts({
    conversationId,
    getArchiveMessages: (id) => getChatArchive(id)?.messages ?? null,
    getLiveMessages: (id) => getActiveConversationLiveMessages(id),
  });
}

describe('Experience conversationTexts wiring', () => {
  let chatId: string;

  beforeEach(() => {
    chatId = createStandaloneChat();
    clearActiveConversationLiveMessages();
  });

  afterEach(() => {
    clearActiveConversationLiveMessages();
  });

  it('Kyoto archive texts → travel via Experience helper + V3', () => {
    const archiveMessages: ArchivedChatMessage[] = [
      { id: 'u1', text: "Kyoto'da akşam yürüyüşü yapmak istiyorum.", isUser: true },
      { id: 'a1', text: 'Gion veya Pontocho güzel olur.', isUser: false },
      { id: 'u2', text: 'Yağmur yağarsa plan nasıl değişir?', isUser: true },
      { id: 'a2', text: 'Kapalı kafe ve müze öneririm.', isUser: false },
      { id: 'u3', text: 'Gion tarafı mı yoksa Pontocho mu?', isUser: true },
    ];
    saveStandaloneChat(chatId, archiveMessages);

    const texts = experienceResolveTexts(chatId);
    expect(texts?.some((t) => /Kyoto/i.test(t))).toBe(true);
    expect(texts?.every((t) => !/Kapalı kafe|Gion veya/i.test(t))).toBe(true);

    const state = buildConversationMirrorState(enoughEntries([['yürüyüş'], ['yürüyüş'], ['yürüyüş'], ['yürüyüş'], ['yürüyüş']]), {
      conversationId: chatId,
      seed: 'exp-kyoto',
      conversationTexts: texts,
    });
    expect(state.dailyMirrorCard.mirrorV3Payload?.storyTopicId).toBe('travel');
  });

  it('10k steps + calories → health', () => {
    saveStandaloneChat(chatId, [
      { id: 'u1', text: 'Her gün 10 bin adım yürüyüş yapmaya çalışıyorum.', isUser: true },
      { id: 'a1', text: 'Harika bir hedef.', isUser: false },
      { id: 'u2', text: 'Kalori yakmak ve kilo vermek istiyorum.', isUser: true },
    ]);
    const texts = experienceResolveTexts(chatId);
    const state = buildConversationMirrorState(enoughEntries([['yürüyüş'], ['adım'], ['kalori'], ['yürüyüş'], ['yürüyüş']]), {
      conversationId: chatId,
      seed: 'exp-health',
      conversationTexts: texts,
    });
    expect(state.dailyMirrorCard.mirrorV3Payload?.storyTopicId).toBe('health');
  });

  it('walkway + sidewalk → architecture', () => {
    saveStandaloneChat(chatId, [
      { id: 'u1', text: 'Yürüyüş yolu genişliği nasıl projelendirilir?', isUser: true },
      { id: 'u2', text: 'Kaldırım ve yaya aksı ölçülerini netleştirelim.', isUser: true },
    ]);
    const texts = experienceResolveTexts(chatId);
    const state = buildConversationMirrorState(enoughEntries([['yürüyüş'], ['yol'], ['yürüyüş'], ['yol'], ['yürüyüş']]), {
      conversationId: chatId,
      seed: 'exp-arch',
      conversationTexts: texts,
    });
    expect(state.dailyMirrorCard.mirrorV3Payload?.storyTopicId).toBe('architecture');
  });

  it('empty archive → undefined texts / safe fallback cues', () => {
    const texts = experienceResolveTexts(chatId);
    expect(texts).toBeUndefined();
  });

  it('assistant messages never enter conversationTexts', () => {
    saveStandaloneChat(chatId, [
      { id: 'u1', text: 'Roma yürüyüş', isUser: true },
      { id: 'a1', text: 'ASSISTANT_SHOULD_NOT_APPEAR_IN_TEXTS', isUser: false },
    ]);
    const texts = experienceResolveTexts(chatId);
    expect(texts?.join(' ')).not.toContain('ASSISTANT_SHOULD_NOT_APPEAR_IN_TEXTS');
  });

  it('message order is preserved from archive', () => {
    saveStandaloneChat(chatId, [
      { id: 'u1', text: 'first-user', isUser: true },
      { id: 'a1', text: 'bot', isUser: false },
      { id: 'u2', text: 'second-user', isUser: true },
      { id: 'u3', text: 'third-user', isUser: true },
    ]);
    expect(experienceResolveTexts(chatId)).toEqual(['first-user', 'second-user', 'third-user']);
  });

  it('live unsaved last user message is merged (autosave gap)', () => {
    saveStandaloneChat(chatId, [
      { id: 'u1', text: "Kyoto'da akşam yürüyüşü", isUser: true },
      { id: 'a1', text: 'Tamam', isUser: false },
    ]);
    setActiveConversationLiveMessages(chatId, [
      { id: 'u1', text: "Kyoto'da akşam yürüyüşü", isUser: true },
      { id: 'a1', text: 'Tamam', isUser: false },
      { id: 'u2', text: 'Yağmur yağarsa Gion mi?', isUser: true },
    ]);
    const texts = experienceResolveTexts(chatId);
    expect(texts?.at(-1)).toMatch(/Yağmur yağarsa Gion/i);
    expect(texts?.filter((t) => /Kyoto/i.test(t)).length).toBe(1);
  });

  it('duplicate live+archive message is included once', () => {
    const msg = { id: 'u1', text: 'Tekrar eden mesaj', isUser: true as const };
    saveStandaloneChat(chatId, [msg]);
    setActiveConversationLiveMessages(chatId, [msg, msg]);
    expect(experienceResolveTexts(chatId)).toEqual(['Tekrar eden mesaj']);
  });

  it('heuristic conversationTexts are bounded', () => {
    const archive = Array.from({ length: 80 }, (_, i) => ({
      id: `u-${i}`,
      text: `Mesaj ${i} ${'içerik '.repeat(40)}`,
      isUser: true as const,
    }));
    const texts = collectConversationTextsForMirror({ archiveMessages: archive });
    expect(texts).toBeDefined();
    const joined = (texts ?? []).join('\n');
    expect(joined.length).toBeLessThanOrEqual(HEURISTIC_CONVERSATION_TEXTS_MAX_CHARS + 20);
    expect((texts ?? []).length).toBeLessThan(80);
  });
});
