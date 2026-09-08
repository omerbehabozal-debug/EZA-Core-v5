/**
 * 8.8G-5.3.2 — conversation title persistence + Yansı title/visual promotion.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveConversationTitle,
  isDefaultConversationTitle,
  resolveDisplayConversationTitle,
  DEFAULT_CONVERSATION_TITLE,
} from '@/lib/eza/conversationTitle';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import {
  createStandaloneChat,
  getChatArchive,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';
import {
  bootstrapServerConversations,
  getServerConversationSummaries,
  persistServerConversationTitleIfNeeded,
  promoteServerConversationIdentityFromYansi,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
  migrateLegacyServerConversations: vi.fn(),
  getServerYansiPreparations: vi.fn(),
  putServerYansiPreparation: vi.fn(),
  linkServerYansiPreparationPublication: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', () => apiMocks);

const summaryBase = {
  id: 'srv-a',
  clientConversationId: 'chat-a',
  title: 'Yeni sohbet',
  preview: '',
  conversationType: 'direct' as const,
  messageCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
  groupId: null as string | null,
};

describe('deriveConversationTitle', () => {
  it('shortens long first questions into stable titles', () => {
    expect(
      deriveConversationTitle("İstanbul'da hafta sonu nereye gidebilirim?")
    ).toBe("İstanbul'da hafta sonu nereye gidebilirim");
    expect(deriveConversationTitle('Kia Sportage mı Toyota C-HR mı?').length).toBeLessThanOrEqual(
      48
    );
  });

  it('returns empty for blank input', () => {
    expect(deriveConversationTitle('   ')).toBe('');
  });
});

describe('resolveDisplayConversationTitle precedence', () => {
  it('Yansı public title outranks conversation title', () => {
    expect(
      resolveDisplayConversationTitle({
        title: 'İstanbul Hafta Sonu',
        yansiPublicTitle: 'Mardin Terası',
      })
    ).toBe('Mardin Terası');
  });

  it('falls back to Yeni sohbet', () => {
    expect(resolveDisplayConversationTitle({ title: 'Yeni sohbet' })).toBe(
      DEFAULT_CONVERSATION_TITLE
    );
    expect(isDefaultConversationTitle(null)).toBe(true);
  });
});

describe('first meaningful message → durable server title', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
  });

  it('changes title from Yeni sohbet and PATCHes initializeTitleOnly', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryBase]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      ...summaryBase,
      title: "İstanbul'da hafta sonu nereye gidebilirim",
    });

    await persistServerConversationTitleIfNeeded(
      'chat-a',
      "İstanbul'da hafta sonu nereye gidebilirim?"
    );

    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith('srv-a', {
      title: "İstanbul'da hafta sonu nereye gidebilirim",
      initializeTitleOnly: true,
    });
    expect(getServerConversationSummaries()[0]?.title).toBe(
      "İstanbul'da hafta sonu nereye gidebilirim"
    );
  });

  it('updates sidebar mapping from store summaries', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryBase]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      ...summaryBase,
      title: 'Sportage vs C-HR',
    });
    await persistServerConversationTitleIfNeeded(
      'chat-a',
      'Kia Sportage mı Toyota C-HR mı?'
    );
    const items = mapArchivesToSainaConversations(getServerConversationSummaries());
    expect(items[0]?.title).not.toBe('Yeni sohbet');
    expect(items[0]?.title).toBe(getServerConversationSummaries()[0]?.title);
  });

  it('does not churn title on later messages', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryBase, title: 'İstanbul Hafta Sonu' },
    ]);
    await bootstrapServerConversations('user-a');
    await persistServerConversationTitleIfNeeded('chat-a', 'İkinci mesaj tamamen farklı');
    expect(apiMocks.patchServerConversation).not.toHaveBeenCalled();
  });

  it('title generation failure does not throw / does not block', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryBase]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockRejectedValue(new Error('network'));
    await expect(
      persistServerConversationTitleIfNeeded('chat-a', 'Başlık denemesi')
    ).resolves.toBeUndefined();
    // Optimistic local store title still applied
    expect(getServerConversationSummaries()[0]?.title).toBe('Başlık denemesi');
  });

  it('stale CAS cannot overwrite newer pinned title', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryBase, title: 'Yeni sohbet' },
    ]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      ...summaryBase,
      title: 'Yansı Başlığı',
      titlePinned: true,
    });
    await persistServerConversationTitleIfNeeded('chat-a', 'Geç gelen otomatik başlık');
    expect(getServerConversationSummaries()[0]?.title).toBe('Yansı Başlığı');
    expect(getServerConversationSummaries()[0]?.titlePinned).toBe(true);
  });

  it('skips initialize when already titlePinned (Yansı outranks)', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        ...summaryBase,
        title: 'Yansı Başlığı',
        titlePinned: true,
        hasReadyYansi: true,
      },
    ]);
    await bootstrapServerConversations('user-a');
    await persistServerConversationTitleIfNeeded('chat-a', 'Geç normal başlık');
    expect(apiMocks.patchServerConversation).not.toHaveBeenCalled();
  });
});

describe('Yansı title/visual promotion', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
  });

  it('promotes title + scene with titlePinned and updates sidebar thumb', async () => {
    const scene =
      'https://api.ezacore.ai/api/public/mirror-scene-assets/yansi.png';
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryBase, title: 'İstanbul Hafta Sonu' },
    ]);
    await bootstrapServerConversations('user-a');
    upsertChatArchive({
      id: 'chat-a',
      title: 'İstanbul Hafta Sonu',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'u1', text: 'hi', isUser: true, timestamp: new Date().toISOString() }],
      serverConversationId: 'srv-a',
    });

    apiMocks.patchServerConversation.mockResolvedValue({
      ...summaryBase,
      title: 'Mardin Terası',
      titlePinned: true,
      hasReadyYansi: true,
      conversationSceneUrl: scene,
      conversationSceneSource: 'mirror_local',
    });

    await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Mardin Terası',
      conversationSceneUrl: scene,
      conversationSceneSource: 'mirror_local',
    });

    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith(
      'srv-a',
      expect.objectContaining({
        title: 'Mardin Terası',
        titlePinned: true,
        conversationSceneUrl: scene,
      })
    );
    const summary = getServerConversationSummaries()[0];
    expect(summary?.title).toBe('Mardin Terası');
    expect(summary?.titlePinned).toBe(true);
    expect(summary?.conversationSceneUrl).toBe(scene);
    expect(getChatArchive('chat-a')?.title).toBe('Mardin Terası');

    const items = mapArchivesToSainaConversations(getServerConversationSummaries());
    expect(items[0]?.title).toBe('Mardin Terası');
    expect(items[0]?.thumbImageUrl).toBe(scene);

    // Late normal title must not downgrade
    await persistServerConversationTitleIfNeeded('chat-a', 'Geç otomatik');
    expect(apiMocks.patchServerConversation).toHaveBeenCalledTimes(1);
  });

  it('allows relative public scene path as sidebar thumb', () => {
    const items = mapArchivesToSainaConversations([
      {
        id: 'chat-b',
        title: 'Yansı',
        preview: '',
        savedAt: '2026-01-01T00:00:00Z',
        messageCount: 1,
        conversationSceneUrl: '/api/public/mirror-scene-assets/abc.png',
      },
    ]);
    expect(items[0]?.thumbImageUrl).toBe('/api/public/mirror-scene-assets/abc.png');
  });
});

describe('guest / ungrouped local title', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createStandaloneChat accepts first-message title', () => {
    const id = createStandaloneChat({ title: "İstanbul'da Hafta Sonu" });
    expect(getChatArchive(id)?.title).toBe("İstanbul'da Hafta Sonu");
  });
});
