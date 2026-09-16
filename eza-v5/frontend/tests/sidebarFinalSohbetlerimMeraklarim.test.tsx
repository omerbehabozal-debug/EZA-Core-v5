/**
 * Final sidebar IA — SOHBETLERİM enrichment (no own-Yansı rows).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import {
  clearAllMirrorJourneyArtifactsForTests,
  enrichConversationItemWithYansiPresentation,
  listReusableYansiForConversation,
  markMirrorJourneyArtifactReadyFromLineage,
  markMirrorJourneyArtifactPublished,
  applyOwnerYansiUnpublishedLocally,
  resolveExactYansiSidebarStatus,
  buildStandaloneYansiHref,
  parseYansiRouteParam,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import {
  assignChatToGroup,
  createStandaloneChat,
  listChatArchives,
} from '@/lib/standaloneChatArchive';
import { createConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { YANSI_SOHBETLERIM_SECTION_TITLE } from '@/lib/eza/mirror/copy';
import {
  clearYansiSaveStore,
  hydrateYansiSaveStore,
} from '@/lib/eza/mirror-network/yansiSaveStore';
import { fetchMySavedYansilar } from '@/lib/eza/mirror-network/yansiSaveApi';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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

vi.mock('@/lib/eza/mirror-network/yansiSaveApi', () => ({
  fetchMySavedYansilar: vi.fn(async () => ({
    ok: true as const,
    data: { items: [], total: 0, limit: 48, offset: 0 },
  })),
  fetchYansiSaveState: vi.fn(),
  saveYansi: vi.fn(),
  unsaveYansi: vi.fn(),
}));

function lineage(
  tag: string,
  opts: { blockIndex?: number; version?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
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

function ready(owner: string, tag: string, conv = 'conv-1', block = 0) {
  return markMirrorJourneyArtifactReadyFromLineage(owner, {
    lineage: lineage(tag, { conv, blockIndex: block }),
    sceneImageUrl: `https://cdn.example/scene-${tag}.jpg`,
    publicTitle: `Title ${tag}`,
    publicSummary: `Summary ${tag}`,
    continuationContext: `Continue ${tag}`,
  });
}

describe('Sidebar final IA — SOHBETLERİM enrichment', () => {
  const owner = () => resolveJourneyOwnerKey(null);

  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
    clearYansiSaveStore();
  });

  it('A. 0 Yansı → conversation only, neutral thumb, no indicator', () => {
    const chatId = createStandaloneChat({ title: 'İstanbul konut' });
    const base = mapArchivesToSainaConversations(listChatArchives());
    const row = enrichConversationItemWithYansiPresentation(
      base.find((r) => r.id === chatId)!,
      [],
      new Map(),
      true
    );
    expect(row.title).toBe('İstanbul konut');
    expect(row.yansiStatus).toBe('none');
    expect(row.additionalYansiCount).toBeUndefined();
    expect(row.representativeYansiCount).toBe(0);
  });

  it('B. exactly 1 READY → Yansı scene/title + bronze/yellow dot', () => {
    const art = ready(owner(), 'a')!;
    const item = enrichConversationItemWithYansiPresentation(
      {
        id: 'conv-1',
        title: 'Conv',
        preview: 'preview text',
        time: 'Az önce',
        thumbGradient: 'g',
      },
      [art],
      new Map(),
      true
    );
    expect(item.title).toBe('Title a');
    expect(item.thumbImageUrl).toContain('scene-a');
    expect(item.preview).toBe('preview text');
    expect(item.yansiStatus).toBe('ready');
    expect(item.additionalYansiCount).toBeUndefined();
  });

  it('C. exactly 1 published → green dot', () => {
    const art = ready(owner(), 'pub')!;
    markMirrorJourneyArtifactPublished(owner(), {
      journeyId: art.journeyId,
      journeyVersion: art.journeyVersion,
      slug: 'pub-slug',
      shareUrl: '/m/pub-slug',
    });
    const published = {
      ...art,
      status: 'published' as const,
      publish: {
        slug: 'pub-slug',
        shareUrl: '/m/pub-slug',
        publishedAt: new Date().toISOString(),
      },
    };
    const item = enrichConversationItemWithYansiPresentation(
      {
        id: 'conv-1',
        title: 'Conv',
        preview: 'p',
        time: 'Az önce',
        thumbGradient: 'g',
      },
      [published],
      new Map([
        ['pub-slug', { slug: 'pub-slug', visibility: 'public', safetyStatus: 'open' }],
      ]),
      true
    );
    expect(item.yansiStatus).toBe('published');
    expect(item.title).toBe('Title pub');
  });

  it('D. exactly 1 withdrawn → red when private publication record exists', () => {
    const art = ready(owner(), 'wd')!;
    const published = {
      ...art,
      status: 'ready' as const,
      publish: {
        slug: 'wd-slug',
        shareUrl: '/m/wd-slug',
        publishedAt: new Date().toISOString(),
      },
    };
    expect(
      resolveExactYansiSidebarStatus({
        artifact: published,
        publicationBySlug: new Map([
          ['wd-slug', { slug: 'wd-slug', visibility: 'private', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('withdrawn');

    const item = enrichConversationItemWithYansiPresentation(
      {
        id: 'conv-1',
        title: 'Conv',
        preview: 'p',
        time: 'Az önce',
        thumbGradient: 'g',
      },
      [published],
      new Map([
        ['wd-slug', { slug: 'wd-slug', visibility: 'private', safetyStatus: 'open' }],
      ]),
      true
    );
    expect(item.yansiStatus).toBe('withdrawn');
  });

  it('D2. red fail-closed without publication record', () => {
    const art = ready(owner(), 'nr')!;
    const withSlug = {
      ...art,
      publish: { slug: 'ghost-slug' },
    };
    expect(
      resolveExactYansiSidebarStatus({
        artifact: withSlug,
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('E/F. 2+ Yansı → latest scene/title +N, no colored dot', () => {
    const a = ready(owner(), 'a', 'conv-1', 0)!;
    const b = ready(owner(), 'b', 'conv-1', 1)!;
    const c = ready(owner(), 'c', 'conv-1', 2)!;
    const two = enrichConversationItemWithYansiPresentation(
      { id: 'conv-1', title: 'Conv', preview: 'p', time: 't', thumbGradient: 'g' },
      [a, b],
      new Map(),
      true
    );
    expect(two.title).toBe('Title b');
    expect(two.thumbImageUrl).toContain('scene-b');
    expect(two.additionalYansiCount).toBe(1);
    expect(two.yansiStatus).toBe('none');

    const three = enrichConversationItemWithYansiPresentation(
      { id: 'conv-1', title: 'Conv', preview: 'p', time: 't', thumbGradient: 'g' },
      [a, b, c],
      new Map(),
      true
    );
    expect(three.title).toBe('Title c');
    expect(three.additionalYansiCount).toBe(2);
    expect(three.yansiStatus).toBe('none');
  });

  it('G. mixed A published B ready C latest → C +2, no aggregate dot', () => {
    const a = {
      ...ready(owner(), 'a', 'conv-1', 0)!,
      status: 'published' as const,
      publish: { slug: 'a-slug', shareUrl: '/m/a', publishedAt: new Date().toISOString() },
    };
    const b = ready(owner(), 'b', 'conv-1', 1)!;
    const c = {
      ...ready(owner(), 'c', 'conv-1', 2)!,
      status: 'ready' as const,
      publish: { slug: 'c-slug', shareUrl: '/m/c', publishedAt: new Date().toISOString() },
    };
    const item = enrichConversationItemWithYansiPresentation(
      { id: 'conv-1', title: 'Conv', preview: 'p', time: 't', thumbGradient: 'g' },
      [a, b, c],
      new Map([
        ['a-slug', { slug: 'a-slug', visibility: 'public', safetyStatus: 'open' }],
        ['c-slug', { slug: 'c-slug', visibility: 'private', safetyStatus: 'open' }],
      ]),
      true
    );
    expect(item.title).toBe('Title c');
    expect(item.thumbImageUrl).toContain('scene-c');
    expect(item.additionalYansiCount).toBe(2);
    expect(item.yansiStatus).toBe('none');
  });

  it('H/I. +N opens exact latest via onSelectYansi; row click only onSelectChat', () => {
    const a = ready(owner(), 'a', 'conv-1', 0)!;
    const b = ready(owner(), 'b', 'conv-1', 1)!;
    const item = enrichConversationItemWithYansiPresentation(
      { id: 'conv-1', title: 'Conv', preview: 'p', time: 't', thumbGradient: 'g' },
      [a, b],
      new Map(),
      true
    );
    const onSelectChat = vi.fn();
    const onSelectYansi = vi.fn();
    render(
      <SainaConversationSidebar
        conversations={[item]}
        activeChatId="conv-1"
        onSelectChat={onSelectChat}
        onSelectYansi={onSelectYansi}
        onDeleteChat={() => undefined}
      />
    );
    fireEvent.click(
      screen.getByTestId('saina-conv-row-conv-1').querySelector('.saina-conv-row-main')!
    );
    expect(onSelectChat).toHaveBeenCalledWith('conv-1');
    expect(onSelectYansi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('saina-sidebar-yansi-more-conv-1'));
    expect(onSelectYansi).toHaveBeenCalled();
    const payload = onSelectYansi.mock.calls[0]![0];
    expect(payload.sourceConversationId).toBe('conv-1');
    expect(payload.journeyId).toBe(b.journeyId);
    expect(payload.journeyVersion).toBe(b.journeyVersion);
  });

  it('J/K. ?yansi= identity helpers remain', () => {
    const href = buildStandaloneYansiHref({
      sourceConversationId: 'conv-1',
      journeyId: 'journey-b',
      journeyVersion: 1,
    });
    expect(href).toContain('chat=conv-1');
    expect(href).toContain('yansi=journey-b%3A%3Av1');
    expect(parseYansiRouteParam('journey-b::v1')).toEqual({
      journeyId: 'journey-b',
      journeyVersion: 1,
    });
  });

  it('L. groups keep conversation rows; no injected own-Yansı', async () => {
    const chatId = createStandaloneChat({ title: 'Grouped' });
    const group = createConversationGroup({ title: 'PROJELER' });
    assignChatToGroup(chatId, group.id);
    ready(owner(), 'g1', chatId, 0);
    ready(owner(), 'g2', chatId, 1);

    const { result } = renderHook(() => useSainaSidebarConversations(listChatArchives()));
    await waitFor(() => {
      expect(result.current.conversations.some((r) => r.id === chatId)).toBe(true);
    });
    expect(result.current.conversations.every((r) => (r.kind ?? 'conversation') !== 'yansi')).toBe(
      true
    );
    const enriched = result.current.conversations.find((r) => r.id === chatId);
    expect(enriched?.additionalYansiCount).toBe(1);
    expect(result.current.conversationGroups.some((g) => g.title === 'PROJELER')).toBe(true);
    const flatKinds = result.current.conversationGroups.flatMap((g) =>
      g.conversations.map((c) => c.kind ?? 'conversation')
    );
    expect(flatKinds.every((k) => k !== 'yansi')).toBe(true);
  });

  it('M. SOHBETLERİM heading always visible', () => {
    render(
      <SainaConversationSidebar
        conversations={[
          {
            id: 'c1',
            title: 'T',
            preview: 'p',
            time: 't',
            thumbGradient: 'g',
          },
        ]}
        onSelectChat={() => undefined}
      />
    );
    expect(screen.getByTestId('saina-sohbetlerim-title')).toHaveTextContent(
      YANSI_SOHBETLERIM_SECTION_TITLE
    );
  });

  it('N. MERAKLARIM stays separate saved-yansi only', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-a',
            publicTitle: 'Saved A',
            authorDisplayName: 'Ahmet',
            sceneImageUrl: 'https://cdn.example/a.jpg',
            availability: 'available',
            savedAt: new Date().toISOString(),
            authorUserId: 'other',
          },
        ],
        total: 1,
        limit: 48,
        offset: 0,
      },
    });
    await hydrateYansiSaveStore();
    render(
      <SainaConversationSidebar
        conversations={[
          {
            id: 'c1',
            title: 'Own',
            preview: 'p',
            time: 't',
            thumbGradient: 'g',
            representativeYansiCount: 1,
            yansiStatus: 'ready',
          },
        ]}
        onSelectChat={() => undefined}
      />
    );
    expect(screen.getByTestId('saina-meraklarim-section')).toBeTruthy();
    expect(screen.getByTestId('saina-saved-yansi-row-yansi-a')).toHaveAttribute(
      'data-sidebar-kind',
      'saved-yansi'
    );
    expect(screen.queryByTestId(/saina-yansi-row-/)).toBeNull();
  });

  it('O. chronology authority is block order — not publication', () => {
    const a = {
      ...ready(owner(), 'a', 'conv-1', 0)!,
      status: 'published' as const,
      publish: { slug: 'a' },
    };
    const b = ready(owner(), 'b', 'conv-1', 1)!;
    const ordered = listReusableYansiForConversation([a, b], 'conv-1');
    expect(ordered.map((r) => r.journeyId)).toEqual([a.journeyId, b.journeyId]);
    const item = enrichConversationItemWithYansiPresentation(
      { id: 'conv-1', title: 'C', preview: 'p', time: 't', thumbGradient: 'g' },
      [a, b],
      new Map([['a', { slug: 'a', visibility: 'public', safetyStatus: 'open' }]]),
      true
    );
    expect(item.title).toBe('Title b');
  });

  it('P. unpublish local path supports red when private inventory present', () => {
    const art = ready(owner(), 'u')!;
    markMirrorJourneyArtifactPublished(owner(), {
      journeyId: art.journeyId,
      journeyVersion: art.journeyVersion,
      slug: 'keep-slug',
      shareUrl: '/m/keep-slug',
    });
    applyOwnerYansiUnpublishedLocally('keep-slug');
    expect(
      resolveExactYansiSidebarStatus({
        artifact: {
          ...art,
          status: 'ready',
          publish: { slug: 'keep-slug' },
        },
        publicationBySlug: new Map([
          ['keep-slug', { slug: 'keep-slug', visibility: 'private', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('withdrawn');
  });

  it('runtime hook does not project own-yansi rows', async () => {
    const chatId = createStandaloneChat({ title: 'Solo' });
    ready(owner(), 'solo', chatId, 0);
    const { result } = renderHook(() => useSainaSidebarConversations(listChatArchives()));
    await waitFor(() => {
      const row = result.current.conversations.find((r) => r.id === chatId);
      expect(row?.title).toBe('Title solo');
    });
    expect(result.current.conversations.every((r) => r.kind !== 'yansi')).toBe(true);
  });
});
