/**
 * Phase 1 identity helpers retained; own-Yansı sidebar projection removed from runtime.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  buildStandaloneYansiHref,
  buildYansiSidebarItemId,
  buildYansiSourceIdentity,
  clearAllMirrorJourneyArtifactsForTests,
  parseYansiRouteParam,
  parseYansiSidebarItemId,
  projectReadyYansiSidebarItems,
  markMirrorJourneyArtifactReadyFromLineage,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { createStandaloneChat, listChatArchives } from '@/lib/standaloneChatArchive';

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

describe('Yansı identity helpers (dormant projection OK)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('builds and parses sidebar/route identity', () => {
    const id = buildYansiSidebarItemId({
      sourceConversationId: 'conv-1',
      journeyId: 'journey-a',
      journeyVersion: 2,
    });
    expect(id).toBe('yansi::conv-1::journey-a::v2');
    expect(parseYansiSidebarItemId(id)).toEqual({
      sourceConversationId: 'conv-1',
      journeyId: 'journey-a',
      journeyVersion: 2,
    });
    expect(buildYansiSourceIdentity('journey-a', 2)).toBe('journey-a::v2');
    expect(parseYansiRouteParam('journey-a::v2')).toEqual({
      journeyId: 'journey-a',
      journeyVersion: 2,
    });
    expect(
      buildStandaloneYansiHref({
        sourceConversationId: 'conv-1',
        journeyId: 'journey-a',
        journeyVersion: 2,
      })
    ).toContain('yansi=journey-a%3A%3Av2');
  });

  it('projectReadyYansiSidebarItems remains callable but runtime hook does not inject rows', async () => {
    const owner = resolveJourneyOwnerKey(null);
    const chatId = createStandaloneChat({ title: 'Chat' });
    markMirrorJourneyArtifactReadyFromLineage(owner, {
      lineage: lineage('x', { conv: chatId }),
      sceneImageUrl: 'https://cdn.example/x.jpg',
      publicTitle: 'Title x',
      publicSummary: 'S',
      continuationContext: 'C',
    });
    const projected = projectReadyYansiSidebarItems(
      [
        markMirrorJourneyArtifactReadyFromLineage(owner, {
          lineage: lineage('x2', { conv: chatId, blockIndex: 1 }),
          sceneImageUrl: 'https://cdn.example/x2.jpg',
          publicTitle: 'Title x2',
          publicSummary: 'S',
          continuationContext: 'C',
        })!,
      ]
    );
    expect(projected.every((r) => r.kind === 'yansi')).toBe(true);

    const { result } = renderHook(() => useSainaSidebarConversations(listChatArchives()));
    await waitFor(() => {
      expect(result.current.conversations.some((r) => r.id === chatId)).toBe(true);
    });
    expect(result.current.conversations.every((r) => r.kind !== 'yansi')).toBe(true);
    const row = result.current.conversations.find((r) => r.id === chatId);
    expect(row?.representativeYansiCount).toBeGreaterThanOrEqual(1);
  });
});
