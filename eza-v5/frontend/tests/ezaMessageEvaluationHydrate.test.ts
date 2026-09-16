/**
 * Durable EZA evaluation hydrate — server detail → archived Message.
 */
import { describe, expect, it } from 'vitest';
import {
  fromArchivedMessages,
  mergeArchivedMessageEvaluations,
  toArchivedMessages,
} from '@/lib/standaloneChatSession';
import type { ArchivedChatMessage } from '@/lib/standaloneChatArchive';

const behavioral = {
  schema_version: 1,
  interaction_id: 'asst-1',
  mode: 'standalone',
  vector: {
    input_risk: 0.1,
    output_risk: 0.12,
    input_health: 0.9,
    output_health: 0.88,
    alignment_score: 80,
    eza_final: 84,
    intent: 'explore',
    alignment_verdict: 'aligned',
    redirect: false,
    redirect_reason: null,
    policy_violation_count: 0,
  },
  asymmetry: {
    health_gap: 0.02,
    risk_delta_output_minus_input: 0.02,
    index: 0.02,
  },
};

describe('EZA evaluation hydrate', () => {
  it('restores userScore / assistantScore / behavioral / safety exactly', () => {
    const archived: ArchivedChatMessage[] = [
      {
        id: 'u1',
        text: 'Soru',
        isUser: true,
        userScore: 80,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a1',
        text: 'Cevap',
        isUser: false,
        assistantScore: 84,
        behavioral,
        safety: 'Safe',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
    ];
    const live = fromArchivedMessages(archived);
    expect(live[0]?.userScore).toBe(80);
    expect(live[0]?.assistantScore).toBeUndefined();
    expect(live[1]?.assistantScore).toBe(84);
    expect(live[1]?.behavioral?.vector.eza_final).toBe(84);
    expect(live[1]?.safety).toBe('Safe');
    expect(live[1]?.safeOnlyMode).toBe(true);
  });

  it('missing metadata → no invented scores', () => {
    const live = fromArchivedMessages([
      { id: 'u', text: 'x', isUser: true },
      { id: 'a', text: 'y', isUser: false },
    ]);
    expect(live[0]?.userScore).toBeUndefined();
    expect(live[1]?.assistantScore).toBeUndefined();
    expect(live[1]?.behavioral).toBeUndefined();
  });

  it('local archive round-trips behavioral + safety', () => {
    const round = toArchivedMessages(
      fromArchivedMessages([
        {
          id: 'a1',
          text: 'Cevap',
          isUser: false,
          assistantScore: 77,
          behavioral,
          safety: 'Warning',
        },
      ])
    );
    expect(round[0]?.assistantScore).toBe(77);
    expect(round[0]?.behavioral?.interaction_id).toBe('asst-1');
    expect(round[0]?.safety).toBe('Warning');
  });

  it('merge keeps richer in-flight local evaluation when server lacks it', () => {
    const server: ArchivedChatMessage[] = [
      { id: 'u1', text: 'Soru', isUser: true },
      { id: 'a1', text: 'Cevap', isUser: false },
    ];
    const local: ArchivedChatMessage[] = [
      { id: 'u1', text: 'Soru', isUser: true, userScore: 88 },
      {
        id: 'a1',
        text: 'Cevap',
        isUser: false,
        assistantScore: 90,
        behavioral,
        safety: 'Safe',
      },
    ];
    const merged = mergeArchivedMessageEvaluations(server, local);
    expect(merged[0]?.userScore).toBe(88);
    expect(merged[1]?.assistantScore).toBe(90);
    expect(merged[1]?.behavioral?.interaction_id).toBe('asst-1');
  });

  it('merge does not overwrite server evaluation with local', () => {
    const server: ArchivedChatMessage[] = [
      { id: 'a1', text: 'Cevap', isUser: false, assistantScore: 70 },
    ];
    const local: ArchivedChatMessage[] = [
      { id: 'a1', text: 'Cevap', isUser: false, assistantScore: 99 },
    ];
    const merged = mergeArchivedMessageEvaluations(server, local);
    expect(merged[0]?.assistantScore).toBe(70);
  });

  it('no bleed across independent message ids', () => {
    const archived: ArchivedChatMessage[] = [
      { id: 'a1', text: 'one', isUser: false, assistantScore: 60 },
      { id: 'a2', text: 'two', isUser: false, assistantScore: 95 },
    ];
    const live = fromArchivedMessages(archived);
    expect(live[0]?.assistantScore).toBe(60);
    expect(live[1]?.assistantScore).toBe(95);
  });
});
