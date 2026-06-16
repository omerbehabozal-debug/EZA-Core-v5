import { describe, expect, it } from 'vitest';
import {
  buildConversationMirrorEntries,
  buildScoreBasedSnapshot,
} from '@/lib/eza/mirror/conversationMirrorEntries';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';

describe('conversationMirrorEntries', () => {
  it('builds one entry per assistant reply using scores when behavioral is missing', () => {
    const entries = buildConversationMirrorEntries([
      {
        id: 'u1',
        text: 'Merhaba',
        isUser: true,
        userScore: 82,
        timestamp: new Date('2026-05-31T10:00:00Z'),
      },
      {
        id: 'a1',
        text: 'Merhaba, nasıl yardımcı olabilirim?',
        isUser: false,
        assistantScore: 88,
        timestamp: new Date('2026-05-31T10:00:05Z'),
      },
      {
        id: 'u2',
        text: 'BMW mi Mercedes mi?',
        isUser: true,
        userScore: 75,
        timestamp: new Date('2026-05-31T10:01:00Z'),
      },
      {
        id: 'a2',
        text: 'İkisi de farklı güçlü yanlara sahip.',
        isUser: false,
        assistantScore: 91,
        timestamp: new Date('2026-05-31T10:01:08Z'),
      },
      {
        id: 'u3',
        text: 'Konfor önceliğim',
        isUser: true,
        userScore: 80,
        timestamp: new Date('2026-05-31T10:02:00Z'),
      },
      {
        id: 'a3',
        text: 'O zaman Mercedes daha uygun olabilir.',
        isUser: false,
        assistantScore: 86,
        timestamp: new Date('2026-05-31T10:02:06Z'),
      },
    ]);

    expect(entries).toHaveLength(3);
    expect(entries.length).toBeGreaterThanOrEqual(MIRROR_MIN_SAMPLES);
    expect(entries[2]?.vector.eza_final).toBe(86);
    expect(entries[2]?.mirrorCueHints?.length).toBeGreaterThan(0);
  });

  it('prefers pipeline behavioral snapshot when present', () => {
    const behavioral = buildScoreBasedSnapshot({
      interactionId: 'pipe-1',
      userScore: 70,
      assistantScore: 72,
    });
    behavioral.vector.intent = 'comparison';

    const entries = buildConversationMirrorEntries([
      { id: 'u1', text: 'Test', isUser: true, timestamp: new Date() },
      {
        id: 'a1',
        text: 'Yanıt',
        isUser: false,
        behavioral,
        assistantScore: 40,
        timestamp: new Date(),
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.vector.intent).toBe('comparison');
    expect(entries[0]?.vector.eza_final).toBe(72);
  });
});
