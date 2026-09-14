import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AynaJourneyReel from '@/components/mirror/ayna/AynaJourneyReel';
import {
  clearAllMirrorJourneyArtifactsForTests,
  type JourneyGenerationLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';

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
  opts: { blockIndex?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: 1,
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

function ready(tag: string, blockIndex = 0): MirrorJourneyArtifact {
  return buildReadyMirrorJourneyArtifactFromLineage({
    lineage: lineage(tag, { blockIndex }),
    sceneImageUrl: `https://cdn.example.com/${tag}.jpg`,
    publicTitle: `Title ${tag}`,
    publicSummary: `Summary ${tag}`,
  })!;
}

function noopActions() {
  return {
    onPublish: vi.fn(),
    onShare: vi.fn(),
    onOpenDiscover: vi.fn(),
    onOpenAuthorProfile: vi.fn(),
    onOpenParent: vi.fn(),
  };
}

describe('AynaJourneyReel explicit artifact selection', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom lacks IntersectionObserver — provide a no-op stub.
    // @ts-expect-error test stub
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('selects A when selectedArtifactIdentity matches A', async () => {
    const artifacts = [ready('a', 0), ready('b', 1)];
    const onVisible = vi.fn();
    render(
      <AynaJourneyReel
        artifacts={artifacts}
        actions={noopActions()}
        selectedArtifactIdentity={{ journeyId: 'journey-a', journeyVersion: 1 }}
        onVisibleArtifactChange={onVisible}
      />
    );

    await waitFor(() => {
      expect(onVisible).toHaveBeenCalled();
      const last = onVisible.mock.calls.at(-1)?.[0] as MirrorJourneyArtifact;
      expect(last.journeyId).toBe('journey-a');
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('selects B when identity switches to B', async () => {
    const artifacts = [ready('a', 0), ready('b', 1)];
    const onVisible = vi.fn();
    const { rerender } = render(
      <AynaJourneyReel
        artifacts={artifacts}
        actions={noopActions()}
        selectedArtifactIdentity={{ journeyId: 'journey-a', journeyVersion: 1 }}
        onVisibleArtifactChange={onVisible}
      />
    );

    rerender(
      <AynaJourneyReel
        artifacts={artifacts}
        actions={noopActions()}
        selectedArtifactIdentity={{ journeyId: 'journey-b', journeyVersion: 1 }}
        onVisibleArtifactChange={onVisible}
      />
    );

    await waitFor(() => {
      const last = onVisible.mock.calls.at(-1)?.[0] as MirrorJourneyArtifact;
      expect(last?.journeyId).toBe('journey-b');
    });
  });

  it('invalid identity does not crash and does not force selection', async () => {
    const artifacts = [ready('a', 0)];
    const onVisible = vi.fn();
    expect(() =>
      render(
        <AynaJourneyReel
          artifacts={artifacts}
          actions={noopActions()}
          selectedArtifactIdentity={{ journeyId: 'missing', journeyVersion: 9 }}
          onVisibleArtifactChange={onVisible}
        />
      )
    ).not.toThrow();
  });
});
