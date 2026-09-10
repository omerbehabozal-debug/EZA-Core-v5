/**
 * 8.8G Yansı identity lifecycle hardening — concurrency + candidate/committed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bootstrapServerConversations,
  clearServerConversationState,
  getServerConversationSummaries,
  persistServerConversationTitleIfNeeded,
  promoteServerConversationIdentityFromYansi,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  getChatArchive,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';

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

const sceneX = 'https://api.ezacore.ai/api/public/mirror-scene-assets/x.png';
const sceneY = 'https://api.ezacore.ai/api/public/mirror-scene-assets/y.png';
const sceneZ = 'https://api.ezacore.ai/api/public/mirror-scene-assets/z.png';

const base = {
  id: 'srv-a',
  clientConversationId: 'chat-a',
  title: 'Title X',
  preview: '',
  conversationType: 'direct' as const,
  messageCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: true,
  groupId: '11111111-1111-1111-1111-111111111111',
  conversationSceneUrl: sceneX,
  conversationSceneSource: 'mirror_local',
  hasReadyYansi: true,
  yansiIdentityGenerationId: 'gen-x',
};

function seedLocalCommittedX() {
  upsertChatArchive({
    id: 'chat-a',
    title: 'Title X',
    preview: '',
    savedAt: new Date().toISOString(),
    messageCount: 2,
    messages: [
      { id: 'u1', text: 'hi', isUser: true, timestamp: new Date().toISOString() },
      { id: 'a1', text: 'yo', isUser: false, timestamp: new Date().toISOString() },
    ],
    titlePinned: true,
    serverConversationId: 'srv-a',
    groupId: base.groupId,
    conversationSceneUrl: sceneX,
    conversationSceneSource: 'mirror_local',
    yansiIdentityGenerationId: 'gen-x',
  });
}

beforeEach(() => {
  localStorage.clear();
  resetServerConversationStoreForTests();
  vi.clearAllMocks();
});

describe('Yansı identity lifecycle hardening', () => {
  it('TEST A: delayed X cannot overwrite committed Y', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');

    // Y succeeds first
    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
    });
    const y = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });
    expect(y).toBe('applied');
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-y');

    // Delayed X — server returns committed Y (CAS no-op)
    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
    });
    const xLate = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title X Late',
      generationId: 'gen-x-late',
      conversationSceneUrl: sceneX,
      conversationSceneSource: 'mirror_local',
    });
    // Client expected gen-y, sent gen-x-late → server no-op returns Y
    expect(apiMocks.patchServerConversation).toHaveBeenLastCalledWith(
      'srv-a',
      expect.objectContaining({
        yansiIdentityGenerationId: 'gen-x-late',
        expectedYansiIdentityGenerationId: 'gen-y',
      })
    );
    expect(xLate).toBe('noop_stale');
    expect(getServerConversationSummaries()[0]?.title).toBe('Title Y');
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-y');
  });

  it('TEST B: committed X scene remains while candidate generation starts (source)', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    const clearFn = src.slice(
      src.indexOf('const clearChatBackgroundScene'),
      src.indexOf('const clearChatBackgroundScene') + 450
    );
    expect(clearFn).toContain('must NOT destroy committed');
    expect(clearFn).not.toMatch(/clearConversationSceneIdentity\(\s*id\s*\)/);
  });

  it('TEST C: failed promotion keeps committed X immediately', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');
    seedLocalCommittedX();

    apiMocks.patchServerConversation.mockRejectedValue(new Error('network'));
    const result = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y Fail',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });
    expect(result).toBe('failed');
    expect(getServerConversationSummaries()[0]?.title).toBe('Title X');
    expect(getServerConversationSummaries()[0]?.conversationSceneUrl).toBe(sceneX);
    expect(getChatArchive('chat-a')?.title).toBe('Title X');
    expect(getChatArchive('chat-a')?.conversationSceneUrl).toBe(sceneX);
  });

  it('TEST D: PATCH failure does not fake durable Y', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');
    seedLocalCommittedX();
    apiMocks.patchServerConversation.mockRejectedValue(new Error('patch_failed'));

    const result = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Fake Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });
    expect(result).toBe('failed');
    const items = mapArchivesToSainaConversations(getServerConversationSummaries());
    expect(items[0]?.title).toBe('Title X');
    expect(items[0]?.thumbImageUrl).toBe(sceneX);
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-x');
  });

  it('TEST E: successful Y replaces X', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');
    seedLocalCommittedX();
    apiMocks.patchServerConversation.mockResolvedValue({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
    });
    const result = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });
    expect(result).toBe('applied');
    expect(getServerConversationSummaries()[0]?.title).toBe('Title Y');
    expect(getServerConversationSummaries()[0]?.conversationSceneUrl).toBe(sceneY);
    expect(getChatArchive('chat-a')?.yansiIdentityGenerationId).toBe('gen-y');
  });

  it('TEST F: X → Y → Z latest wins', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');

    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
    });
    await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });

    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...base,
      title: 'Title Z',
      conversationSceneUrl: sceneZ,
      yansiIdentityGenerationId: 'gen-z',
      groupId: base.groupId,
    });
    const z = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Z',
      generationId: 'gen-z',
      conversationSceneUrl: sceneZ,
      conversationSceneSource: 'mirror_local',
    });
    expect(z).toBe('applied');
    expect(apiMocks.patchServerConversation).toHaveBeenLastCalledWith(
      'srv-a',
      expect.objectContaining({
        expectedYansiIdentityGenerationId: 'gen-y',
        yansiIdentityGenerationId: 'gen-z',
      })
    );
    expect(getServerConversationSummaries()[0]?.title).toBe('Title Z');
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-z');
  });

  it('TEST G: ordinary later title initialize cannot change Y', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...base, title: 'Title Y', yansiIdentityGenerationId: 'gen-y', titlePinned: true },
    ]);
    await bootstrapServerConversations('user-a');
    await persistServerConversationTitleIfNeeded('chat-a', 'Yeni sohbet mesajı');
    expect(apiMocks.patchServerConversation).not.toHaveBeenCalled();
    expect(getServerConversationSummaries()[0]?.title).toBe('Title Y');
  });

  it('TEST H: late initializeTitleOnly cannot downgrade Y', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        ...base,
        title: 'Title Y',
        titlePinned: true,
        yansiIdentityGenerationId: 'gen-y',
        conversationSceneUrl: sceneY,
      },
    ]);
    await bootstrapServerConversations('user-a');
    await persistServerConversationTitleIfNeeded('chat-a', 'Geç otomatik başlık');
    expect(apiMocks.patchServerConversation).not.toHaveBeenCalled();
  });

  it('TEST I: grouped conversation promotion keeps groupId', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
      groupId: base.groupId,
    });
    await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });
    expect(getServerConversationSummaries()[0]?.groupId).toBe(base.groupId);
    const patchArg = apiMocks.patchServerConversation.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(patchArg).not.toHaveProperty('groupId');
  });

  it('TEST J: account switch discards late promotion', async () => {
    apiMocks.listServerConversations.mockResolvedValue([{ ...base }]);
    await bootstrapServerConversations('user-a');

    let resolvePatch!: (v: unknown) => void;
    apiMocks.patchServerConversation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve;
        })
    );

    const pending = promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-a',
      title: 'Title Y',
      generationId: 'gen-y',
      conversationSceneUrl: sceneY,
      conversationSceneSource: 'mirror_local',
    });

    clearServerConversationState();
    apiMocks.listServerConversations.mockResolvedValue([
      {
        ...base,
        id: 'srv-b',
        clientConversationId: 'chat-b',
        title: 'User B',
        yansiIdentityGenerationId: null,
      },
    ]);
    await bootstrapServerConversations('user-b');

    resolvePatch({
      ...base,
      title: 'Title Y',
      conversationSceneUrl: sceneY,
      yansiIdentityGenerationId: 'gen-y',
    });
    const result = await pending;
    expect(result).toBe('failed');
    expect(getServerConversationSummaries()[0]?.title).toBe('User B');
  });
});
