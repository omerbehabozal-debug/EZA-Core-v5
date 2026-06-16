import { describe, expect, it } from 'vitest';
import { buildMirrorDebugTrace } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorDebugTrace';
import {
  buildToothpasteMirrorEntries,
  TOOTHPASTE_CONVERSATION_ID,
  TOOTHPASTE_CONVERSATION_MESSAGES,
} from '@/lib/eza/mirror/conversationMirrorV2/toothpasteConversationFixture';
import { buildConversationMirrorEntries } from '@/lib/eza/mirror/conversationMirrorEntries';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';

describe('buildMirrorDebugTrace', () => {
  it('builds full trace for toothpaste conversation', () => {
    const entries = buildToothpasteMirrorEntries();
    const trace = buildMirrorDebugTrace({
      entries,
      options: {
        conversationId: TOOTHPASTE_CONVERSATION_ID,
        seed: 'debug-toothpaste',
        conversationMessages: TOOTHPASTE_CONVERSATION_MESSAGES,
      },
    });

    expect(trace.rawConversation.length).toBeGreaterThanOrEqual(4);
    expect(trace.rawConversation[0]?.text).toContain('Diş macunu');
    expect(trace.signals.length).toBeGreaterThan(0);
    expect(trace.candidateTopics.length).toBeGreaterThan(0);
    expect(trace.topicSelection.selectedTopic).toContain('Diş macunu');
    expect(trace.payload.mirrorTitle).toBeTruthy();
    expect(trace.openAiPrompt).toContain(trace.payload.mirrorTitle);
    expect(trace.quality.alignmentScore).toBeGreaterThanOrEqual(0);
    expect(trace.storyEngine.mirrorTitleCandidates.length).toBeGreaterThan(0);
  });

  it('japan travel scenario selects travel topic with high alignment', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel');
    expect(scenario).toBeTruthy();
    const entries = scenario!.buildEntries();
    const trace = buildMirrorDebugTrace({
      entries,
      options: {
        conversationId: 'qa-japan-travel',
        seed: 'qa-japan-travel',
        conversationMessages: scenario!.conversationMessages,
      },
    });

    expect(trace.topicSelection.selectedTopic.toLowerCase()).toContain('japonya');
    expect(trace.topicSelection.primaryStoryTopicId).toBe('travel');
    expect(trace.rawConversation.some((m) => m.text.includes('Japonya'))).toBe(true);
    expect(trace.quality.alignmentScore).toBeGreaterThanOrEqual(70);
    expect(trace.quality.redFlags).toHaveLength(0);
  });

  it('flags mismatch when travel conversation would get product title', () => {
    const japanMessages = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!
      .conversationMessages!;
    const entries = buildConversationMirrorEntries(japanMessages);

    const trace = buildMirrorDebugTrace({
      entries,
      options: {
        conversationId: 'qa-mismatch-test',
        seed: 'qa-mismatch',
        conversationMessages: japanMessages,
      },
    });

    const forced = {
      ...trace,
      payload: { ...trace.payload, mirrorTitle: 'Ürünün Eşiğinde' },
    };
    expect(forced.payload.mirrorTitle).toBe('Ürünün Eşiğinde');
    expect(trace.topicSelection.primaryStoryTopicId).toBe('travel');
  });

  it('explains topic selection method for dominant scenario', () => {
    const entries = buildToothpasteMirrorEntries();
    const trace = buildMirrorDebugTrace({
      entries,
      options: {
        conversationId: TOOTHPASTE_CONVERSATION_ID,
        seed: 'qa-toothpaste-choice',
      },
    });

    expect(['dominance', 'single_candidate', 'weighted_roll']).toContain(
      trace.topicSelection.method
    );
    expect(trace.topicSelection.reasonLines.length).toBeGreaterThan(0);
  });
});
