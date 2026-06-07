import { describe, it, expect } from 'vitest';
import {
  buildChatHistoryPayload,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_TOTAL_CHARS,
} from '@/lib/standaloneChatHistory';

describe('buildChatHistoryPayload', () => {
  it('returns empty array for no prior messages', () => {
    expect(buildChatHistoryPayload([])).toEqual([]);
  });

  it('builds Uzbekistan → 7-day route history', () => {
    const messages = [
      {
        id: 'user-1',
        text: "Özbekistan'da nereler gezilir?",
        isUser: true,
      },
      {
        id: 'eza-1',
        text: 'Semerkant, Buhara ve Taşkent öne çıkar.',
        isUser: false,
      },
    ];

    const history = buildChatHistoryPayload(messages);
    expect(history).toEqual([
      { role: 'user', content: "Özbekistan'da nereler gezilir?" },
      { role: 'assistant', content: 'Semerkant, Buhara ve Taşkent öne çıkar.' },
    ]);
  });

  it('excludes system and empty assistant messages', () => {
    const messages = [
      { id: 'limit-1', text: 'limit reached', isUser: false },
      { id: 'user-1', text: 'hello', isUser: true },
      { id: 'eza-1', text: '   ', isUser: false },
      { id: 'eza-2', text: 'world', isUser: false },
    ];

    expect(buildChatHistoryPayload(messages)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
  });

  it('sends only role and content without metadata', () => {
    const messages = [
      {
        id: 'user-1',
        text: 'test',
        isUser: true,
        userScore: 88,
        assistantScore: undefined,
      } as {
        id: string;
        text: string;
        isUser: boolean;
        userScore?: number;
      },
    ];

    const history = buildChatHistoryPayload(messages);
    expect(history).toEqual([{ role: 'user', content: 'test' }]);
    expect(Object.keys(history[0])).toEqual(['role', 'content']);
  });

  it('excludes duplicate query from history when excludeQuery is set', () => {
    const messages = [
      { id: 'user-1', text: 'same question', isUser: true },
    ];

    expect(
      buildChatHistoryPayload(messages, { excludeQuery: 'same question' })
    ).toEqual([]);
  });

  it('keeps only the last N messages', () => {
    const messages = Array.from({ length: 14 }, (_, i) => ({
      id: `user-${i}`,
      text: `msg-${i}`,
      isUser: i % 2 === 0,
    }));

    const history = buildChatHistoryPayload(messages);
    expect(history).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(history[0].content).toBe('msg-4');
    expect(history[MAX_HISTORY_MESSAGES - 1].content).toBe('msg-13');
  });

  it('truncates oldest messages when char budget exceeded', () => {
    const chunk = 'a'.repeat(500);
    const messages = Array.from({ length: 8 }, (_, i) => ({
      id: `m-${i}`,
      text: chunk,
      isUser: i % 2 === 0,
    }));

    const history = buildChatHistoryPayload(messages, {
      maxTotalChars: MAX_HISTORY_TOTAL_CHARS,
    });
    const total = history.reduce((sum, m) => sum + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_HISTORY_TOTAL_CHARS);
    expect(history.length).toBeLessThan(8);
    expect(history[history.length - 1].content).toBe(chunk);
  });
});
