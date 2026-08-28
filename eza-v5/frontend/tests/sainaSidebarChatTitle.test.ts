import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_TITLE_MAX_LEN,
  summarizeArchiveTitle,
} from '@/lib/standaloneChatArchive';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';

describe('summarizeArchiveTitle', () => {
  it('keeps full curiosity questions without ellipsis', () => {
    const title =
      'Mardin taş evlerinde yaşam nasıl bir deneyim?';
    expect(summarizeArchiveTitle(title)).toBe(title);
    expect(summarizeArchiveTitle(title)).not.toContain('…');
  });

  it('strips legacy ellipsis suffix before display', () => {
    expect(summarizeArchiveTitle('Kyoto akşam rotası…')).toBe('Kyoto akşam rotası');
  });

  it('caps extreme lengths at word boundary without ellipsis', () => {
    const long = 'a'.repeat(ARCHIVE_TITLE_MAX_LEN + 20);
    const out = summarizeArchiveTitle(long);
    expect(out.length).toBeLessThanOrEqual(ARCHIVE_TITLE_MAX_LEN);
    expect(out).not.toContain('…');
  });
});

describe('mapArchivesToSainaConversations titles', () => {
  it('prefers fuller preview over legacy truncated title', () => {
    const [item] = mapArchivesToSainaConversations([
      {
        id: 'chat-1',
        title: 'Kyoto’da akşam…',
        preview: 'Kyoto’da yağmurlu bir akşam neler yapılabilir?',
        savedAt: new Date().toISOString(),
        messageCount: 2,
      },
    ]);
    expect(item.title).toContain('yağmurlu bir akşam');
    expect(item.title).not.toContain('…');
  });
});
