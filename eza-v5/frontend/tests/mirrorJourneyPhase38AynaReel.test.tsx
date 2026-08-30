/**
 * Phase 3.8 — Ayna vertical reel + author/lineage + action isolation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AynaJourneyReel from '@/components/mirror/ayna/AynaJourneyReel';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import {
  buildGeneratingMirrorJourneyArtifact,
  buildReadyMirrorJourneyArtifactFromLineage,
  applyPublishSuccessToArtifact,
  applyPublishFailureToArtifact,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  clearAllMirrorJourneyArtifactsForTests,
  listJourneyArtifactsForConversation,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  markMirrorJourneyArtifactPublished,
  upsertMirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { resolveJourneyArtifactShareIdentity } from '@/lib/eza/mirror/journey/resolveJourneyArtifactShareIdentity';
import {
  artifactMatchesLiveCard,
  buildPublishCardFromArtifact,
} from '@/lib/eza/mirror/journey/buildPublishCardFromArtifact';
import {
  formatParentLineageLabel,
  resolveAuthorDisplayName,
} from '@/lib/eza/mirror/journey/aynaAuthorDisplay';
import {
  MIRROR_AYNA_EMPTY_BODY,
  MIRROR_AYNA_EMPTY_TITLE,
  MIRROR_JOURNEY_STATUS_GENERATING,
  MIRROR_JOURNEY_STATUS_READY,
  MIRROR_AYNA_STATUS_PUBLISHED,
} from '@/lib/eza/mirror/copy';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { JourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

vi.mock('@/hooks/useResolvedProfileAvatar', () => ({
  useResolvedProfileAvatar: () => ({ url: null, revision: undefined }),
}));

function lineage(partial: Partial<JourneyGenerationLineage> & {
  journeyId: string;
  sourceConversationId: string;
}): JourneyGenerationLineage {
  const steps = Array.from({ length: 6 }, (_, i) => ({
    stepIndex: i + 1,
    sourceOrder: i,
    sourceUserMessageId: `u${i}`,
    sourceAssistantMessageId: `a${i}`,
    publicQuestion: `Q${i + 1}`,
    publicAnswer: `A${i + 1}`,
  }));
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyVersion: 1,
    parentJourneyId: null,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: 'wh',
    scopedInputHash: 'sih',
    selectedStepsHash: 'ssh',
    interpretationHash: 'ih',
    publicLandingHash: 'plh',
    mappedPromptHash: 'mph',
    generationId: `gen-${partial.journeyId}`,
    selectedSteps: steps,
    sealedAt: new Date().toISOString(),
    ...partial,
  };
}

function readyArtifact(
  journeyId: string,
  extras: Partial<MirrorJourneyArtifact> = {}
): MirrorJourneyArtifact {
  const row = buildReadyMirrorJourneyArtifactFromLineage({
    lineage: lineage({
      journeyId,
      sourceConversationId: 'conv-1',
      windowIndex: extras.blockIndex ?? 0,
      blockIndex: extras.blockIndex ?? 0,
    }),
    sceneImageUrl: extras.sceneImageUrl ?? 'https://cdn.example/scene.jpg',
    publicTitle: extras.publicTitle ?? `Title ${journeyId}`,
    publicSummary: extras.publicSummary ?? `Summary ${journeyId}`,
    sealedPublicLanding: {
      publicTitle: extras.publicTitle ?? `Title ${journeyId}`,
      publicSummary: extras.publicSummary ?? `Summary ${journeyId}`,
      continuationContext: 'devam',
      semanticSource: 'd2_interpretation',
      interpretationHash: 'ih',
      publicLandingHash: 'plh',
      contractVersion: 'mirror-public-landing-v1',
    },
  })!;
  return {
    ...row,
    authorUserId: extras.authorUserId ?? 'user-b',
    authorDisplayName: extras.authorDisplayName ?? 'Ömer Bozal',
    parentJourneyId: extras.parentJourneyId,
    parentSlug: extras.parentSlug,
    parentAuthorDisplayName: extras.parentAuthorDisplayName,
    parentPublicTitle: extras.parentPublicTitle,
    experienceCount: extras.experienceCount,
    childYansiCount: extras.childYansiCount,
    experienceStartedCount: extras.experienceStartedCount,
    directChildYansiCount: extras.directChildYansiCount,
    status: extras.status ?? 'ready',
    publish: extras.publish ?? {},
  };
}

describe('mirrorJourneyPhase38AynaReel', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    localStorage.clear();
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', IO);
  });
  afterEach(() => {
    cleanup();
    clearAllMirrorJourneyArtifactsForTests();
    vi.unstubAllGlobals();
  });

  it('A. EMPTY — empty state when no artifacts', () => {
    render(
      <AynaJourneyReel
        artifacts={[]}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
        emptyState={
          <div data-testid="ayna-empty-state">
            <p>{MIRROR_AYNA_EMPTY_TITLE}</p>
            <p>{MIRROR_AYNA_EMPTY_BODY}</p>
          </div>
        }
      />
    );
    expect(screen.getByTestId('ayna-journey-reel-empty')).toBeTruthy();
    expect(screen.getByText(MIRROR_AYNA_EMPTY_TITLE)).toBeTruthy();
  });

  it('B. MULTI ARTIFACT — A/B/C render in canonical order without overwrite', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-a',
      sourceConversationId: 'conv-1',
      blockIndex: 0,
    });
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-b',
      sourceConversationId: 'conv-1',
      blockIndex: 1,
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-a',
        sourceConversationId: 'conv-1',
        windowIndex: 0,
        blockIndex: 0,
      }),
      publicTitle: 'A title',
      publicSummary: 'A summary',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-b',
        sourceConversationId: 'conv-1',
        windowIndex: 1,
        blockIndex: 1,
      }),
      publicTitle: 'B title',
      publicSummary: 'B summary',
    });
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-c',
      sourceConversationId: 'conv-1',
      blockIndex: 2,
    });
    const listed = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(listed.map((a) => a.journeyId)).toEqual([
      'journey-a',
      'journey-b',
      'journey-c',
    ]);
    expect(listed[0]?.publicTitle).toBe('A title');
    expect(listed[1]?.publicTitle).toBe('B title');
    expect(listed[2]?.status).toBe('generating');

    render(
      <AynaJourneyReel
        artifacts={listed}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getAllByTestId('ayna-journey-slide')).toHaveLength(3);
  });

  it('C. GENERATING — appears immediately; completion updates same artifact', () => {
    const generating = buildGeneratingMirrorJourneyArtifact({
      journeyId: 'journey-g',
      sourceConversationId: 'conv-1',
      blockIndex: 0,
      authorDisplayName: 'Ömer',
    });
    render(
      <AynaJourneySlide
        artifact={generating}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('ayna-slide-generating')).toBeTruthy();
    expect(screen.getByText(MIRROR_JOURNEY_STATUS_GENERATING)).toBeTruthy();

    const ready = readyArtifact('journey-g');
    cleanup();
    render(
      <AynaJourneySlide
        artifact={ready}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('ayna-slide-status').textContent).toContain(
      MIRROR_JOURNEY_STATUS_READY
    );
    expect(screen.getAllByText('Title journey-g').length).toBeGreaterThan(0);
  });

  it('D/E. READY + PUBLISHED — preview fields + identity-scoped actions', () => {
    const onPublish = vi.fn();
    const onShare = vi.fn();
    const onOpenDiscover = vi.fn();
    const ready = readyArtifact('journey-ready');
    render(
      <AynaJourneySlide
        artifact={ready}
        actions={{
          onPublish,
          onShare,
          onOpenDiscover,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getAllByText('Title journey-ready').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Summary journey-ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Ömer Bozal')).toBeTruthy();

    const published = applyPublishSuccessToArtifact(ready, {
      slug: 'slug-ready',
      shareUrl: 'https://saina.app/m/slug-ready',
    });
    cleanup();
    render(
      <AynaJourneySlide
        artifact={published}
        actions={{
          onPublish,
          onShare,
          onOpenDiscover,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('ayna-slide-status').textContent).toContain(
      MIRROR_AYNA_STATUS_PUBLISHED
    );
  });

  it('F. FAILED — isolated; publish failure keeps ready', () => {
    const failed = applyPublishFailureToArtifact(
      buildGeneratingMirrorJourneyArtifact({
        journeyId: 'journey-f',
        sourceConversationId: 'conv-1',
        blockIndex: 0,
      }),
      'boom'
    );
    // generating + publish fail path → failed status from applyPublishFailure
    expect(failed.status === 'failed' || failed.generationError).toBeTruthy();

    const ready = readyArtifact('journey-keep');
    const afterPublishFail = applyPublishFailureToArtifact(ready, 'publish boom');
    expect(afterPublishFail.status).toBe('ready');
    expect(afterPublishFail.publicTitle).toBe(ready.publicTitle);
  });

  it('G. ACTION ISOLATION — actions bind to acted artifact, not newest', () => {
    const onPublish = vi.fn();
    const onShare = vi.fn();
    const onOpenDiscover = vi.fn();
    const a = applyPublishSuccessToArtifact(readyArtifact('journey-a', { blockIndex: 0 }), {
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
    });
    const b = readyArtifact('journey-b', { blockIndex: 1 });
    const c = buildGeneratingMirrorJourneyArtifact({
      journeyId: 'journey-c',
      sourceConversationId: 'conv-1',
      blockIndex: 2,
    });
    render(
      <AynaJourneyReel
        artifacts={[a, b, c]}
        actions={{
          onPublish,
          onShare,
          onOpenDiscover,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    const slides = screen.getAllByTestId('ayna-journey-slide');
    expect(slides[0]?.getAttribute('data-journey-id')).toBe('journey-a');
    // Share on A
    const shareButtons = screen.getAllByRole('button', { name: /Paylaş/i });
    fireEvent.click(shareButtons[0]!);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare.mock.calls[0][0].journeyId).toBe('journey-a');
    // Publish on B
    const publishButtons = screen.getAllByRole('button', { name: /Yayınla/i });
    fireEvent.click(publishButtons[0]!);
    expect(onPublish.mock.calls[0][0].journeyId).toBe('journey-b');

    const shareA = resolveJourneyArtifactShareIdentity({
      ownerUserId: 'user-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    // Without store publish, identity null unless we upsert
    upsertMirrorJourneyArtifact('user-1', a);
    const shareStored = resolveJourneyArtifactShareIdentity({
      ownerUserId: 'user-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(shareStored?.slug).toBe('slug-a');
    expect(shareStored?.journeyId).toBe('journey-a');
  });

  it('H. NEW ARRIVAL — listing grows without replacing prior identity', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-a',
      sourceConversationId: 'conv-1',
      blockIndex: 0,
    });
    const before = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(before).toHaveLength(1);
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-b',
      sourceConversationId: 'conv-1',
      blockIndex: 1,
    });
    const after = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(after).toHaveLength(2);
    expect(after[0]?.journeyId).toBe('journey-a');
  });

  it('I/J. DESKTOP/MOBILE — CSS uses vertical snap reel (source contract)', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/saina-mirror.css'),
      'utf8'
    );
    expect(css).toContain('scroll-snap-type: y mandatory');
    expect(css).toContain('.ayna-journey-reel');
    expect(css).toContain('.ayna-journey-slide');
    const reelSrc = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AynaJourneyReel.tsx'),
      'utf8'
    );
    expect(reelSrc).toContain('AynaJourneySlide');
    expect(reelSrc).not.toContain('horizontal');
  });

  it('K. REFRESH — artifacts restore independently from store', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-a',
        sourceConversationId: 'conv-1',
        blockIndex: 0,
        windowIndex: 0,
      }),
      publicTitle: 'Persist A',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-b',
        sourceConversationId: 'conv-1',
        blockIndex: 1,
        windowIndex: 1,
      }),
      publicTitle: 'Persist B',
    });
    const listed = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(listed).toHaveLength(2);
    expect(listed.map((a) => a.publicTitle)).toEqual(['Persist A', 'Persist B']);
  });

  it('L. CROSS USER — private Ayna artifacts isolated by owner', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-a',
      sourceConversationId: 'conv-shared',
      blockIndex: 0,
    });
    expect(listJourneyArtifactsForConversation('user-2', 'conv-shared')).toHaveLength(
      0
    );
  });

  it('M. METRICS — real only; undefined omitted; no fake zeros', () => {
    const without = readyArtifact('m1');
    render(
      <AynaJourneySlide
        artifact={without}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.queryByTestId('ayna-slide-metrics')).toBeNull();
    cleanup();
    const withMetrics = readyArtifact('m2', {
      experienceCount: 42,
      childYansiCount: 99,
      experienceStartedCount: 140,
      directChildYansiCount: 7,
    });
    render(
      <AynaJourneySlide
        artifact={withMetrics}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
          onOpenChildren: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '140 deneyim · 7 Yansı'
    );
    expect(screen.queryByText('42 deneyim')).toBeNull();
    expect(screen.queryByTestId('ayna-child-count')).toBeNull();
  });

  it('N/O. AUTHOR — artifact author, not logged-in inference; child keeps own author', () => {
    expect(
      resolveAuthorDisplayName({ fullName: 'Ömer Bozal', userId: 'x' })
    ).toBe('Ömer Bozal');
    const child = readyArtifact('child', {
      authorUserId: 'user-b',
      authorDisplayName: 'Ömer Bozal',
      parentAuthorDisplayName: 'Ahmet',
      parentSlug: 'parent-slug',
    });
    expect(child.authorDisplayName).toBe('Ömer Bozal');
    expect(child.parentAuthorDisplayName).toBe('Ahmet');
  });

  it('P/Q. AUTHOR PROFILE + PRIVACY — profile helpers and published-only contract', () => {
    const onOpenProfile = vi.fn();
    render(
      <AynaAuthorRow displayName="Ömer Bozal" onOpenProfile={onOpenProfile} />
    );
    fireEvent.click(screen.getByTestId('ayna-author-row'));
    expect(onOpenProfile).toHaveBeenCalled();
    const authorApi = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchAuthorPublished.ts'),
      'utf8'
    );
    expect(authorApi).toContain('/authors/');
    expect(authorApi).toContain('/published');
    const backend = readFileSync(
      join(
        process.cwd(),
        '..',
        'backend',
        'services',
        'mirror_network',
        'author_profile.py'
      ),
      'utf8'
    );
    expect(backend).toContain('list_published_mirrors_for_author');
    expect(backend).toContain('_is_public_published');
  });

  it('R/S/U. ROOT vs CHILD lineage + same-author continuation', () => {
    const root = readyArtifact('root');
    render(
      <AynaJourneySlide
        artifact={root}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.queryByTestId('ayna-parent-lineage')).toBeNull();
    cleanup();
    const child = readyArtifact('child', {
      authorDisplayName: 'Ömer Bozal',
      parentAuthorDisplayName: 'Ömer Bozal',
      parentSlug: 'parent-slug',
      parentJourneyId: 'parent',
    });
    expect(formatParentLineageLabel('Ömer Bozal')).toContain('Ömer Bozal');
    render(
      <AynaJourneySlide
        artifact={child}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('ayna-parent-lineage')).toBeTruthy();
  });

  it('T. NAVIGATION DISTINCTION — author → profile; parent → parent Yansı', () => {
    const onOpenAuthorProfile = vi.fn();
    const onOpenParent = vi.fn();
    render(
      <AynaJourneySlide
        artifact={readyArtifact('child', {
          authorDisplayName: 'Ömer Bozal',
          parentAuthorDisplayName: 'Ahmet',
          parentSlug: 'ahmet-yansi',
          parentJourneyId: 'parent',
        })}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile,
          onOpenParent,
        }}
      />
    );
    fireEvent.click(screen.getByTestId('ayna-author-row'));
    expect(onOpenAuthorProfile).toHaveBeenCalled();
    expect(onOpenParent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ayna-parent-lineage'));
    expect(onOpenParent).toHaveBeenCalled();
    expect(onOpenParent.mock.calls[0][0].parentSlug).toBe('ahmet-yansi');
  });

  it('V. PARENT UNAVAILABLE — calm non-nav lineage; card remains usable', () => {
    render(
      <AynaParentLineageRow parentAuthorDisplayName="Ahmet" />
    );
    expect(screen.getByTestId('ayna-parent-lineage').tagName).toBe('P');
    const child = readyArtifact('child', {
      parentAuthorDisplayName: 'Ahmet',
      parentJourneyId: 'gone',
      // no parentSlug → no navigation
    });
    cleanup();
    render(
      <AynaJourneySlide
        artifact={child}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getAllByText('Title child').length).toBeGreaterThan(0);
  });

  it('W. CHILD COUNT — canonical row is not a navigator; legacy count is not “deneyim”', () => {
    const onOpenChildren = vi.fn();
    render(
      <AynaJourneySlide
        artifact={readyArtifact('w', { childYansiCount: 7, experienceCount: 42 })}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
          onOpenChildren,
        }}
      />
    );
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText('42 deneyim')).toBeNull();
    expect(screen.queryByTestId('ayna-child-count')).toBeNull();
  });

  it('X. LEGACY — flag-off path still present in ObservationExperience', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(src).toContain('useAynaJourneyReel');
    expect(src).toContain('ayna-legacy-panel');
    expect(src).toContain('isMirrorJourneyV1ClientEnabled');
  });

  it('publish card rebuild prefers matching live card, never foreign journey', () => {
    const artifact = readyArtifact('journey-a');
    const liveForeign = {
      mirrorJourneyGenerationLineage: lineage({
        journeyId: 'journey-c',
        sourceConversationId: 'conv-1',
        blockIndex: 2,
        windowIndex: 2,
      }),
    } as DailyMirrorCardModel;
    expect(artifactMatchesLiveCard(artifact, liveForeign)).toBe(false);
    const card = buildPublishCardFromArtifact({
      artifact,
      liveCard: liveForeign,
    });
    expect(card?.mirrorJourneyGenerationLineage?.journeyId).toBe('journey-a');
  });

  it('published store mark isolates share identity per journey', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-a',
        sourceConversationId: 'conv-1',
        blockIndex: 0,
        windowIndex: 0,
      }),
      publicTitle: 'A',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage({
        journeyId: 'journey-b',
        sourceConversationId: 'conv-1',
        blockIndex: 1,
        windowIndex: 1,
      }),
      publicTitle: 'B',
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
    });
    const a = resolveJourneyArtifactShareIdentity({
      ownerUserId: 'user-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    const b = resolveJourneyArtifactShareIdentity({
      ownerUserId: 'user-1',
      journeyId: 'journey-b',
      journeyVersion: 1,
    });
    expect(a?.slug).toBe('slug-a');
    expect(b).toBeNull();
  });
});
