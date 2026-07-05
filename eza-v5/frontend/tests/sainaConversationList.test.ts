import { describe, expect, it } from 'vitest';
import {
  formatSainaConversationTime,
  getConversationTimeBucketLabel,
  groupConversationsByTimeBucket,
  mapArchivesToSainaConversations,
  thumbGradientForChatId,
} from '@/lib/eza/sainaConversationList';
import { SAINA_SIDEBAR_FREE_FOOTER } from '@/lib/eza/sainaCopy';

/** Reference: Sunday 5 July 2026, 12:00 local — week starts Monday 29 June. */
const REF_SUNDAY_JULY_5_2026 = new Date(2026, 6, 5, 12, 0, 0);

function isoLocal(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

describe('sainaConversationList', () => {
  it('maps archive summaries to SAINA conversation rows', () => {
    const rows = mapArchivesToSainaConversations([
      {
        id: 'chat-abc',
        title: 'Özbekistan gezisi hakkında uzun bir başlık',
        preview: 'Semerkant ve Buhara',
        savedAt: new Date().toISOString(),
        messageCount: 4,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('chat-abc');
    expect(rows[0]?.title).toBeTruthy();
    expect(rows[0]?.preview).toBe('Semerkant ve Buhara');
    expect(rows[0]?.thumbGradient).toBe(thumbGradientForChatId('chat-abc'));
  });

  it('maps persistable conversation scene URL to sidebar thumb', () => {
    const rows = mapArchivesToSainaConversations([
      {
        id: 'chat-scene',
        title: 'Ayna sohbeti',
        preview: 'Sokak lambaları',
        savedAt: new Date().toISOString(),
        messageCount: 2,
        conversationSceneUrl: 'https://cdn.example/mirror-scene.jpg',
      },
    ]);

    expect(rows[0]?.thumbImageUrl).toBe('https://cdn.example/mirror-scene.jpg');
  });

  it('omits non-persistable scene URLs from sidebar thumb', () => {
    const rows = mapArchivesToSainaConversations([
      {
        id: 'chat-blob',
        title: 'Geçici sahne',
        preview: 'Önizleme',
        savedAt: new Date().toISOString(),
        messageCount: 1,
        conversationSceneUrl: 'blob:https://localhost/scene',
      },
    ]);

    expect(rows[0]?.thumbImageUrl).toBeNull();
  });

  it('formats recent archive time as Az önce', () => {
    const savedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatSainaConversationTime(savedAt)).toBe('Az önce');
  });

  it('groups conversations into time buckets for sidebar', () => {
    const now = new Date();
    const today = now.toISOString();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString();

    const groups = groupConversationsByTimeBucket(
      mapArchivesToSainaConversations([
        {
          id: 'chat-today',
          title: 'Bugün',
          preview: 'a',
          savedAt: today,
          messageCount: 1,
        },
        {
          id: 'chat-yesterday',
          title: 'Dün',
          preview: 'b',
          savedAt: yesterday,
          messageCount: 1,
        },
      ])
    );

    expect(groups.map((g) => g.label)).toEqual(['Bugün', 'Dün']);
    expect(groups[0]?.items[0]?.id).toBe('chat-today');
    expect(getConversationTimeBucketLabel(today)).toBe('Bugün');
    expect(getConversationTimeBucketLabel(yesterday)).toBe('Dün');
  });

  it('uses calendar week buckets with Monday week start', () => {
    const ref = REF_SUNDAY_JULY_5_2026;

    expect(getConversationTimeBucketLabel(isoLocal(2026, 6, 5), ref)).toBe('Bugün');
    expect(getConversationTimeBucketLabel(isoLocal(2026, 6, 4), ref)).toBe('Dün');
    expect(getConversationTimeBucketLabel(isoLocal(2026, 6, 2), ref)).toBe('Bu hafta');
    expect(getConversationTimeBucketLabel(isoLocal(2026, 5, 28), ref)).toBe('Geçen hafta');
    expect(getConversationTimeBucketLabel(isoLocal(2026, 5, 14), ref)).toBe('Daha eski');
  });

  it('renders sidebar free footer copy constant', () => {
    expect(SAINA_SIDEBAR_FREE_FOOTER).toBe('SAINA Free · Hesabını Yükselt →');
  });
});
