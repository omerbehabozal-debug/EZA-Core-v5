import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  buildStandaloneYansiHref,
  buildYansiSidebarItemId,
  buildYansiSourceIdentity,
  clearAllMirrorJourneyArtifactsForTests,
  injectYansiItemsIntoConversationTree,
  mergeFlatSidebarWithYansiItems,
  parseYansiRouteParam,
  parseYansiSidebarItemId,
  projectReadyYansiSidebarItems,
  upsertMirrorJourneyArtifact,
  type JourneyGenerationLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import {
  buildGeneratingMirrorJourneyArtifact,
  buildReadyMirrorJourneyArtifactFromLineage,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import {
  assignChatToGroup,
  createStandaloneChat,
  listChatArchives,
  setConversationSceneIdentity,
} from '@/lib/standaloneChatArchive';
import { createConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { resolveRenderedGroupDeleteAuthority } from '@/lib/eza/conversation-tree/deleteRenderedConversationGroup';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isAuthReady: true,
    user: null,
    token: null,
    role: null,
    setAuth: () => undefined,
    patchAuthUser: () => undefined,
    logout: () => undefined,
  }),
}));

function lineage(
  tag: string,
  opts: {
    blockIndex?: number;
    version?: number;
    conv?: string;
    journeyId?: string;
  } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  const journeyId = (opts.journeyId || `journey-${tag}`).toLowerCase();
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId,
    journeyVersion: opts.version ?? 1,
    sourceConversationId: opts.conv ?? 'conv-1',
    windowIndex: block,
    windowStart: block * 8,
    windowEnd: block * 8 + 7,
    blockIndex: block,
    windowHash: `h-${tag}`,
    sourceBlockHash: `b-${tag}`,
    scopedInputHash: `s-${tag}`,
    selectedStepsHash: `t-${tag}`,
    selectedCount: 8,
    interpretationHash: `i-${tag}`,
    publicLandingHash: `p-${tag}`,
    mappedPromptHash: `m-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `asset-${tag}`,
    sealedAt: new Date().toISOString(),
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: block * 8 + i,
      sourceUserMessageId: `u-${tag}-${i}`,
      sourceAssistantMessageId: `a-${tag}-${i}`,
      publicQuestion: `Q ${tag} ${i}?`,
      publicAnswer: `A ${tag} ${i}.`,
    })),
  };
}

function readyArtifact(
  tag: string,
  extras: Partial<MirrorJourneyArtifact> & {
    conv?: string;
    journeyId?: string;
    version?: number;
  } = {}
): MirrorJourneyArtifact {
  const conv = extras.conv ?? extras.sourceConversationId ?? 'conv-1';
  const row = buildReadyMirrorJourneyArtifactFromLineage({
    lineage: lineage(tag, {
      blockIndex: extras.blockIndex,
      version: extras.version ?? extras.journeyVersion,
      conv,
      journeyId: extras.journeyId,
    }),
    sceneImageUrl:
      extras.sceneImageUrl ?? `https://cdn.example.com/scenes/${tag}.jpg`,
    publicTitle: extras.publicTitle ?? `Title ${tag}`,
    publicSummary: extras.publicSummary ?? `Summary ${tag}`,
    sealedPublicLanding: extras.sealedPublicLanding,
  })!;
  return {
    ...row,
    status: extras.status ?? 'ready',
    createdAt: extras.createdAt ?? row.createdAt,
    updatedAt: extras.updatedAt ?? row.updatedAt,
  };
}

describe('Phase 1 — Yansı sidebar projection', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
  });

  afterEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('1. one conversation + READY A → conversation unchanged + A as separate row', () => {
    const chatId = createStandaloneChat({ title: 'Kaynak sohbet' });
    const owner = resolveJourneyOwnerKey(null);
    upsertMirrorJourneyArtifact(
      owner,
      readyArtifact('a', {
        conv: chatId,
        publicTitle: 'İstanbul Semtleri',
        sceneImageUrl: 'https://cdn.example.com/a.jpg',
      })
    );

    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives(), chatId)
    );

    const convRow = result.current.conversations.find((r) => r.id === chatId);
    const yansiRows = result.current.conversations.filter((r) => r.kind === 'yansi');
    expect(convRow?.title).toBe('Kaynak sohbet');
    expect(convRow?.kind ?? 'conversation').toBe('conversation');
    expect(yansiRows).toHaveLength(1);
    expect(yansiRows[0]?.title).toBe('İstanbul Semtleri');
    expect(yansiRows[0]?.id).not.toBe(chatId);
  });

  it('2–3. A then B READY → two rows coexist; A title/thumb unchanged', async () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const owner = resolveJourneyOwnerKey(null);
    upsertMirrorJourneyArtifact(
      owner,
      readyArtifact('a', {
        conv: chatId,
        blockIndex: 0,
        publicTitle: 'İstanbul Semtleri',
        sceneImageUrl: 'https://cdn.example.com/a.jpg',
      })
    );

    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives(), chatId)
    );
    const afterA = result.current.conversations.filter((r) => r.kind === 'yansi');
    expect(afterA).toHaveLength(1);
    const aTitle = afterA[0]!.title;
    const aThumb = afterA[0]!.thumbImageUrl;

    upsertMirrorJourneyArtifact(
      owner,
      readyArtifact('b', {
        conv: chatId,
        blockIndex: 1,
        publicTitle: "İstanbul'da Çocuklu Yaşam",
        sceneImageUrl: 'https://cdn.example.com/b.jpg',
      })
    );

    await waitFor(() => {
      const yansi = result.current.conversations.filter((r) => r.kind === 'yansi');
      expect(yansi).toHaveLength(2);
    });

    const yansi = result.current.conversations.filter((r) => r.kind === 'yansi');
    const rowA = yansi.find((r) => r.journeyId === 'journey-a')!;
    const rowB = yansi.find((r) => r.journeyId === 'journey-b')!;
    expect(rowA.title).toBe(aTitle);
    expect(rowA.thumbImageUrl).toBe(aThumb);
    expect(rowB.title).toBe("İstanbul'da Çocuklu Yaşam");
    expect(rowB.thumbImageUrl).toBe('https://cdn.example.com/b.jpg');
  });

  it('4. Yansı row id is artifact-specific, not conversationId', () => {
    const id = buildYansiSidebarItemId({
      sourceConversationId: 'conv-c',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(id).toBe('yansi::conv-c::journey-a::v1');
    expect(id).not.toBe('conv-c');
    expect(parseYansiSidebarItemId(id)).toEqual({
      sourceConversationId: 'conv-c',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
  });

  it('5–6. route contains chat + artifact identity for A and B', () => {
    const hrefA = buildStandaloneYansiHref({
      sourceConversationId: 'conv-c',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    const hrefB = buildStandaloneYansiHref({
      sourceConversationId: 'conv-c',
      journeyId: 'journey-b',
      journeyVersion: 1,
    });
    expect(hrefA).toContain('chat=conv-c');
    expect(hrefA).toContain('yansi=journey-a%3A%3Av1');
    expect(hrefB).toContain('chat=conv-c');
    expect(hrefB).toContain('yansi=journey-b%3A%3Av1');
    expect(parseYansiRouteParam('journey-a::v1')).toEqual({
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(hrefA).not.toEqual(hrefB);
  });

  it('7–8. reload identity parse + invalid yansi falls back safely', () => {
    expect(parseYansiRouteParam('journey-a::v1')).toEqual({
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(parseYansiRouteParam('not-a-valid')).toBeNull();
    expect(parseYansiRouteParam('')).toBeNull();
    expect(parseYansiRouteParam(null)).toBeNull();
    expect(parseYansiRouteParam('journey-a::vx')).toBeNull();
  });

  it('9. thumbs use artifact sceneImageUrl, not conversationSceneUrl', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/conversation-shared.jpg',
      source: 'mirror_local',
    });
    const owner = resolveJourneyOwnerKey(null);
    upsertMirrorJourneyArtifact(
      owner,
      readyArtifact('a', {
        conv: chatId,
        blockIndex: 0,
        sceneImageUrl: 'https://cdn.example.com/a.jpg',
      })
    );
    upsertMirrorJourneyArtifact(
      owner,
      readyArtifact('b', {
        conv: chatId,
        blockIndex: 1,
        sceneImageUrl: 'https://cdn.example.com/b.jpg',
      })
    );

    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives(), chatId)
    );
    const yansi = result.current.conversations.filter((r) => r.kind === 'yansi');
    expect(yansi.map((r) => r.thumbImageUrl)).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
    expect(
      yansi.every(
        (r) => r.thumbImageUrl !== 'https://cdn.example.com/conversation-shared.jpg'
      )
    ).toBe(true);
  });

  it('10. Yansı inherit source conversation group placement', () => {
    const group = createConversationGroup({ title: 'Geziler' });
    const chatId = createStandaloneChat({ title: 'İstanbul', groupId: group.id });
    assignChatToGroup(chatId, group.id);
    const projected = projectReadyYansiSidebarItems([
      readyArtifact('a', {
        conv: chatId,
        publicTitle: 'Semtler',
        sceneImageUrl: 'https://cdn.example.com/a.jpg',
      }),
      readyArtifact('b', {
        conv: chatId,
        blockIndex: 1,
        publicTitle: 'Çocuklu yaşam',
        sceneImageUrl: 'https://cdn.example.com/b.jpg',
      }),
    ]);
    const archives = listChatArchives();
    const tree = buildConversationTree(archives, [group], chatId);
    const groupByConv: Record<string, string | null> = { [chatId]: group.id };
    const injected = injectYansiItemsIntoConversationTree(
      tree,
      projected,
      groupByConv
    );
    const target = injected.find((g) => g.id === group.id);
    expect(target).toBeTruthy();
    const kinds = target!.conversations.map((c) => c.kind ?? 'conversation');
    expect(kinds).toContain('conversation');
    expect(kinds.filter((k) => k === 'yansi')).toHaveLength(2);
  });

  it('11. projected Yansı items are kind=yansi (no conversation actions surface)', () => {
    const items = projectReadyYansiSidebarItems([
      readyArtifact('a', { sceneImageUrl: 'https://cdn.example.com/a.jpg' }),
    ]);
    expect(items[0]?.kind).toBe('yansi');
    expect(items[0]?.id.startsWith('yansi::')).toBe(true);
  });

  it('12. conversation-only chats remain unchanged', () => {
    createStandaloneChat({ title: 'Sadece sohbet' });
    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives())
    );
    expect(
      result.current.conversations.every(
        (r) => (r.kind ?? 'conversation') === 'conversation'
      )
    ).toBe(true);
  });

  it('13. empty-group delete authority unchanged for conversationCount', () => {
    expect(
      resolveRenderedGroupDeleteAuthority({
        id: 'group-local-1',
        title: 'Boş',
        conversationCount: 0,
      })
    ).toBe('local');
    expect(
      resolveRenderedGroupDeleteAuthority({
        id: 'group-local-1',
        title: 'Dolu',
        conversationCount: 1,
      })
    ).toBe('blocked_non_empty');
  });

  it('14. READY + published project; generating/failed do not', () => {
    const ready = readyArtifact('ready', {
      status: 'ready',
      sceneImageUrl: 'https://cdn.example.com/ready.jpg',
    });
    const published = readyArtifact('pub', {
      blockIndex: 1,
      status: 'published',
      sceneImageUrl: 'https://cdn.example.com/pub.jpg',
      publicTitle: 'Published',
    });
    const generating = buildGeneratingMirrorJourneyArtifact({
      journeyId: 'journey-gen',
      sourceConversationId: 'conv-1',
      blockIndex: 2,
    });
    const failed: MirrorJourneyArtifact = {
      ...readyArtifact('fail', { blockIndex: 3 }),
      status: 'failed',
      generationError: 'boom',
    };
    const items = projectReadyYansiSidebarItems([
      ready,
      published,
      generating,
      failed,
    ]);
    expect(items.map((i) => i.journeyId).sort()).toEqual([
      'journey-pub',
      'journey-ready',
    ]);
  });

  it('15. old sealed READY projects without regeneration', () => {
    const sealed = readyArtifact('old', {
      publicTitle: undefined,
      sealedPublicLanding: {
        publicTitle: 'Eski Mühürlü Başlık',
        publicSummary: 'Eski özet',
        continuationContext: 'devam',
      },
      sceneImageUrl: 'https://cdn.example.com/old.jpg',
    });
    // Force title authority through sealed landing only.
    sealed.publicTitle = null;
    const items = projectReadyYansiSidebarItems([sealed]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Eski Mühürlü Başlık');
    expect(items[0]?.thumbImageUrl).toBe('https://cdn.example.com/old.jpg');
  });

  it('merge keeps conversation order and appends Yansı after source', () => {
    const base = mapArchivesToSainaConversations(
      [
        {
          id: 'c1',
          title: 'One',
          preview: '',
          savedAt: '2026-01-01T00:00:00.000Z',
          messageCount: 1,
        },
        {
          id: 'c2',
          title: 'Two',
          preview: '',
          savedAt: '2026-01-02T00:00:00.000Z',
          messageCount: 1,
        },
      ],
      null
    );
    const yansi = projectReadyYansiSidebarItems([
      readyArtifact('a', { conv: 'c1', blockIndex: 0 }),
      readyArtifact('b', { conv: 'c1', blockIndex: 1 }),
    ]);
    const merged = mergeFlatSidebarWithYansiItems(base, yansi);
    const ids = merged.map((r) => r.id);
    const c1 = ids.indexOf('c1');
    const ya = ids.indexOf(
      buildYansiSidebarItemId({
        sourceConversationId: 'c1',
        journeyId: 'journey-a',
        journeyVersion: 1,
      })
    );
    const yb = ids.indexOf(
      buildYansiSidebarItemId({
        sourceConversationId: 'c1',
        journeyId: 'journey-b',
        journeyVersion: 1,
      })
    );
    expect(c1).toBeGreaterThanOrEqual(0);
    expect(ya).toBe(c1 + 1);
    expect(yb).toBe(c1 + 2);
    expect(buildYansiSourceIdentity('journey-a', 1)).toBe('journey-a::v1');
  });
});
