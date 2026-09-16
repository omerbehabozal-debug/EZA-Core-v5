import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  clearAllMirrorJourneyArtifactsForTests,
  listAllJourneyArtifactsForOwner,
  loadMirrorJourneyArtifact,
  projectReadyYansiSidebarItems,
  upsertMirrorJourneyArtifact,
  buildStandaloneYansiHref,
  type JourneyGenerationLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { applyPublishSuccessToArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { hydrateOwnerYansiPreparationsFromServer } from '@/lib/eza/mirror/journey/hydrateOwnerYansiPreparationsFromServer';
import {
  beginAccountSession,
  clearServerConversationState,
  getServerConversationAuthority,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import { projectReadyYansiSidebarItems } from '@/lib/eza/mirror/journey/projectYansiSidebarItems';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { createConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import {
  assignChatToGroup,
  createStandaloneChat,
  listChatArchives,
} from '@/lib/standaloneChatArchive';

const apiMocks = vi.hoisted(() => ({
  listAllServerYansiPreparationsForOwner: vi.fn(),
  listOwnerYansiPreparationsPage: vi.fn(),
  listServerConversations: vi.fn(),
  listServerConversationsPage: vi.fn(),
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

const OWNER_A = 'user-a-owner-wide';
const OWNER_B = 'user-b-owner-wide';

function lineage(
  tag: string,
  opts: { conv?: string; blockIndex?: number } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: 1,
    sourceConversationId: opts.conv ?? 'chat-c',
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
    sealedAt: '2026-09-14T00:00:00.000Z',
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

function serverPrep(input: {
  journeyId: string;
  conversationId: string;
  title: string;
  summary: string;
  scene: string;
  windowIndex?: number;
  publishedSlug?: string | null;
}): Parameters<
  typeof hydrateOwnerYansiPreparationsFromServer
> extends never
  ? never
  : {
      id: string;
      conversationId: string;
      sourceIdentity: string;
      journeyId: string;
      journeyVersion: number;
      windowIndex: number;
      windowHash: string;
      selectedStepsHash: string;
      generationId: string;
      status: 'ready';
      publicTitle: string;
      publicSummary: string;
      sceneImageUrl: string;
      sealedLineage: Record<string, unknown>;
      sealedPublicLanding: Record<string, unknown>;
      publishedSlug?: string | null;
      createdAt: string;
      updatedAt?: string | null;
    } {
  const tag = input.journeyId.replace(/^journey-/, '');
  return {
    id: `prep-${input.journeyId}`,
    conversationId: input.conversationId,
    sourceIdentity: `${input.journeyId}::v1`,
    journeyId: input.journeyId,
    journeyVersion: 1,
    windowIndex: input.windowIndex ?? 0,
    windowHash: `win-${tag}`,
    selectedStepsHash: `steps-${tag}`,
    generationId: `gen-${tag}`,
    status: 'ready',
    publicTitle: input.title,
    publicSummary: input.summary,
    sceneImageUrl: input.scene,
    sealedLineage: lineage(tag, {
      conv: input.conversationId,
      blockIndex: input.windowIndex,
    }) as unknown as Record<string, unknown>,
    sealedPublicLanding: {
      publicTitle: input.title,
      publicSummary: input.summary,
      continuationContext: 'devam',
    },
    publishedSlug: input.publishedSlug ?? null,
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T01:00:00.000Z',
  };
}

describe('owner-wide Yansı preparation bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
    resetServerConversationStoreForTests();
    clearServerConversationState();
    apiMocks.listAllServerYansiPreparationsForOwner.mockReset();
  });

  afterEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    resetServerConversationStoreForTests();
  });

  it('A. clean browser + one READY server prep → sidebar row without opening chat', async () => {
    beginAccountSession(OWNER_A);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'İstanbul Semtleri',
        summary: 'özet A',
        scene: 'https://cdn.example.com/a.jpg',
      }),
    ]);
    const authority = getServerConversationAuthority();
    const rows = await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    expect(rows).toHaveLength(1);
    const projected = projectReadyYansiSidebarItems(
      listAllJourneyArtifactsForOwner(OWNER_A)
    );
    expect(projected).toHaveLength(1);
    expect(projected[0]?.title).toBe('İstanbul Semtleri');
    expect(projected[0]?.thumbImageUrl).toBe('https://cdn.example.com/a.jpg');
    expect(projected[0]?.sourceConversationId).toBe('chat-c');
  });

  it('B/C. A/B same conversation + X on another conversation', async () => {
    beginAccountSession(OWNER_A);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'A',
        summary: 'sa',
        scene: 'https://cdn.example.com/a.jpg',
        windowIndex: 0,
      }),
      serverPrep({
        journeyId: 'journey-b',
        conversationId: 'chat-c',
        title: 'B',
        summary: 'sb',
        scene: 'https://cdn.example.com/b.jpg',
        windowIndex: 1,
      }),
      serverPrep({
        journeyId: 'journey-x',
        conversationId: 'chat-d',
        title: 'X',
        summary: 'sx',
        scene: 'https://cdn.example.com/x.jpg',
        publishedSlug: 'slug-x',
      }),
    ]);
    const authority = getServerConversationAuthority();
    await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    const projected = projectReadyYansiSidebarItems(
      listAllJourneyArtifactsForOwner(OWNER_A)
    );
    expect(projected.map((p) => p.journeyId).sort()).toEqual([
      'journey-a',
      'journey-b',
      'journey-x',
    ]);
  });

  it('D. group inheritance via sourceConversationId', async () => {
    beginAccountSession(OWNER_A);
    const group = createConversationGroup({ title: 'Geziler' });
    const chatId = createStandaloneChat({ title: 'İstanbul', groupId: group.id });
    assignChatToGroup(chatId, group.id);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: chatId,
        title: 'Semtler',
        summary: 's',
        scene: 'https://cdn.example.com/a.jpg',
      }),
    ]);
    const authority = getServerConversationAuthority();
    await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    const yansi = projectReadyYansiSidebarItems(
      listAllJourneyArtifactsForOwner(OWNER_A)
    );
    // Dormant helper still projects if called; runtime sidebar no longer injects.
    expect(yansi.some((row) => row.kind === 'yansi')).toBe(true);
    const tree = buildConversationTree(listChatArchives(), [group], chatId);
    expect(
      tree
        .flatMap((g) => g.conversations)
        .every((c) => (c.kind ?? 'conversation') !== 'yansi')
    ).toBe(true);
  });

  it('E/F. local A + server A dedupe; server metadata refreshes', async () => {
    beginAccountSession(OWNER_A);
    const local = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage('a', { conv: 'chat-c' }),
      sceneImageUrl: 'https://cdn.example.com/old-a.jpg',
      publicTitle: 'Old A',
      publicSummary: 'old',
    })!;
    upsertMirrorJourneyArtifact(OWNER_A, local);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'New A',
        summary: 'new',
        scene: 'https://cdn.example.com/new-a.jpg',
      }),
    ]);
    const authority = getServerConversationAuthority();
    await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    const all = listAllJourneyArtifactsForOwner(OWNER_A).filter(
      (a) => a.journeyId === 'journey-a'
    );
    expect(all).toHaveLength(1);
    expect(all[0]?.publicTitle).toBe('New A');
    expect(all[0]?.sceneImageUrl).toBe('https://cdn.example.com/new-a.jpg');
  });

  it('G. local published is not demoted by incoming ready', async () => {
    beginAccountSession(OWNER_A);
    const ready = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage('a', { conv: 'chat-c' }),
      sceneImageUrl: 'https://cdn.example.com/a.jpg',
      publicTitle: 'A',
      publicSummary: 's',
    })!;
    const published = applyPublishSuccessToArtifact(ready, {
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
    });
    upsertMirrorJourneyArtifact(OWNER_A, published);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'A',
        summary: 's',
        scene: 'https://cdn.example.com/a.jpg',
        publishedSlug: null,
      }),
    ]);
    const authority = getServerConversationAuthority();
    await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    const row = loadMirrorJourneyArtifact(OWNER_A, 'journey-a', 1);
    expect(row?.status).toBe('published');
  });

  it('H. failed owner-wide fetch preserves local artifacts', async () => {
    beginAccountSession(OWNER_A);
    const local = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage('a', { conv: 'chat-c' }),
      sceneImageUrl: 'https://cdn.example.com/a.jpg',
      publicTitle: 'Local A',
      publicSummary: 's',
    })!;
    upsertMirrorJourneyArtifact(OWNER_A, local);
    apiMocks.listAllServerYansiPreparationsForOwner.mockRejectedValue(
      new Error('network')
    );
    const authority = getServerConversationAuthority();
    await expect(
      hydrateOwnerYansiPreparationsFromServer({
        ownerUserId: OWNER_A,
        ownerAtStart: authority.ownerKey,
        epochAtStart: authority.epoch,
      })
    ).rejects.toThrow('network');
    expect(listAllJourneyArtifactsForOwner(OWNER_A)).toHaveLength(1);
    expect(listAllJourneyArtifactsForOwner(OWNER_A)[0]?.publicTitle).toBe('Local A');
  });

  it('I. late User A response after switch to B does not upsert', async () => {
    beginAccountSession(OWNER_A);
    const authorityA = getServerConversationAuthority();
    let resolveFetch!: (value: unknown) => void;
    apiMocks.listAllServerYansiPreparationsForOwner.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const pending = hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authorityA.ownerKey,
      epochAtStart: authorityA.epoch,
    });
    clearServerConversationState();
    beginAccountSession(OWNER_B);
    resolveFetch([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'Leaked A',
        summary: 's',
        scene: 'https://cdn.example.com/a.jpg',
      }),
    ]);
    const rows = await pending;
    expect(rows).toEqual([]);
    expect(listAllJourneyArtifactsForOwner(OWNER_B)).toHaveLength(0);
    expect(listAllJourneyArtifactsForOwner(OWNER_A)).toHaveLength(0);
  });

  it('J. missing sourceConversationId skipped', async () => {
    beginAccountSession(OWNER_A);
    const bad = serverPrep({
      journeyId: 'journey-a',
      conversationId: '   ',
      title: 'Bad',
      summary: 's',
      scene: 'https://cdn.example.com/a.jpg',
    });
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([bad]);
    const authority = getServerConversationAuthority();
    const rows = await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    expect(rows).toHaveLength(0);
  });

  it('K. hydrated row still builds exact Yansı route', async () => {
    beginAccountSession(OWNER_A);
    apiMocks.listAllServerYansiPreparationsForOwner.mockResolvedValue([
      serverPrep({
        journeyId: 'journey-a',
        conversationId: 'chat-c',
        title: 'A',
        summary: 's',
        scene: 'https://cdn.example.com/a.jpg',
      }),
    ]);
    const authority = getServerConversationAuthority();
    await hydrateOwnerYansiPreparationsFromServer({
      ownerUserId: OWNER_A,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    const item = projectReadyYansiSidebarItems(
      listAllJourneyArtifactsForOwner(OWNER_A)
    )[0]!;
    expect(
      buildStandaloneYansiHref({
        sourceConversationId: item.sourceConversationId!,
        journeyId: item.journeyId!,
        journeyVersion: item.journeyVersion!,
      })
    ).toContain('chat=chat-c');
    expect(
      buildStandaloneYansiHref({
        sourceConversationId: item.sourceConversationId!,
        journeyId: item.journeyId!,
        journeyVersion: item.journeyVersion!,
      })
    ).toContain('yansi=journey-a%3A%3Av1');
  });
});
