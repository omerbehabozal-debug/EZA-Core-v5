import { describe, expect, it } from 'vitest';
import {
  formatSainaConversationTime,
  mapArchivesToSainaConversations,
  thumbGradientForChatId,
} from '@/lib/eza/sainaConversationList';

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

  it('formats recent archive time as Az önce', () => {
    const savedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatSainaConversationTime(savedAt)).toBe('Az önce');
  });
});
