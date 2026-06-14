import { describe, it, expect } from 'vitest';
import {
  archivesHaveMessages,
  backfillBehavioralHistoryFromArchives,
  buildBehavioralEntriesFromArchives,
  buildPatternSystemNotifications,
  collectArchiveTurnPairs,
  resolvePatternDeviceState,
} from '@/lib/eza/patternDeviceSync';
import type { ArchivedChat } from '@/lib/standaloneChatArchive';

function sampleChat(): ArchivedChat {
  const savedAt = new Date(Date.now() - 2 * 86400000).toISOString();
  return {
    id: 'chat-1',
    title: 'Özbekistan gezisi',
    preview: 'Plan',
    savedAt,
    messageCount: 2,
    messages: [
      {
        id: 'u1',
        text: 'Özbekistan gezisi planlıyorum, Semerkant nereler gezilir?',
        isUser: true,
        timestamp: savedAt,
        userScore: 82,
      },
      {
        id: 'a1',
        text: 'Semerkant için Registan önerilir.',
        isUser: false,
        timestamp: savedAt,
        assistantScore: 88,
      },
    ],
  };
}

describe('patternDeviceSync', () => {
  it('collects user-assistant pairs from archives', () => {
    const pairs = collectArchiveTurnPairs([sampleChat()]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.user.text).toContain('Özbekistan');
  });

  it('builds behavioral entries with exploration category for travel chats', () => {
    const entries = buildBehavioralEntriesFromArchives([sampleChat()]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.standaloneObservation?.user_pattern.category).toBe(
      'curiosity_exploration'
    );
  });

  it('resolves chats_pending_pattern when archives exist but map is empty', () => {
    const state = resolvePatternDeviceState({
      isPremium: true,
      entries: [],
      archives: [{ ...sampleChat(), pinned: undefined, titlePinned: undefined }],
    });
    expect(state).toBe('chats_pending_pattern');
    expect(archivesHaveMessages([{ ...sampleChat(), pinned: undefined, titlePinned: undefined }])).toBe(
      true
    );
  });

  it('resolves has_data after backfill entries', () => {
    const entries = buildBehavioralEntriesFromArchives([sampleChat()]);
    const state = resolvePatternDeviceState({
      isPremium: true,
      entries,
      archives: [{ ...sampleChat(), pinned: undefined, titlePinned: undefined }],
    });
    expect(state).toBe('has_data');
  });

  it('builds notification when chats exist but pattern is pending', () => {
    const notifications = buildPatternSystemNotifications('chats_pending_pattern');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.body).toContain('ilişki haritası');
  });

  it('skips backfill when not in browser', () => {
    if (typeof window === 'undefined') {
      expect(backfillBehavioralHistoryFromArchives().reason).toBe('not_needed');
    }
  });
});
