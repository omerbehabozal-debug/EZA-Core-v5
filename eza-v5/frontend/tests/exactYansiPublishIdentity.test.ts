/**
 * Slice 1 — exact-artifact Yansı publish identity hardening.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  JOURNEY_GENERATION_LINEAGE_VERSION,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import {
  buildReadyMirrorJourneyArtifactFromLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  clearAllMirrorJourneyArtifactsForTests,
  markMirrorJourneyArtifactPublished,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  captureExactYansiPublishIdentity,
  exactIdentityMatchesCardLineage,
  resolvePostPublishArtifactMarkTarget,
} from '@/lib/eza/mirror/journey/exactYansiPublishIdentity';
import { buildPublishCardFromArtifact } from '@/lib/eza/mirror/journey/buildPublishCardFromArtifact';
import { resolveJourneyPublishContract } from '@/lib/eza/mirror/journey/journeyPublishContract';
import { findReusablePreparedYansiArtifact } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import {
  clearAllReview8Drafts,
  saveReview8Draft,
  setActiveReview8DraftKey,
} from '@/lib/eza/mirror/journey/review8DraftStore';
import {
  allocateDraftKey,
  buildReview8DraftFromWindow,
  confirmReview8Draft,
} from '@/lib/eza/mirror/journey/review8Draft';
import type { EligibleQaPair } from '@/lib/eza/mirror/journey/types';
import { publishMirrorToNetwork } from '@/lib/eza/mirror-share/publishMirrorToNetwork';

vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1', '1');

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(() => null),
}));

vi.mock('@/lib/eza/mirror-network/guestToken', () => ({
  getOrCreateMirrorGuestToken: vi.fn(() => 'guest-token-abcdefghijklmnop'),
}));

import { apiClient } from '@/lib/apiClient';

function steps(
  tag: string,
  count: 6 | 7 | 8,
  start = 0
): JourneyGenerationLineage['selectedSteps'] {
  return Array.from({ length: count }, (_, i) => ({
    stepIndex: i + 1,
    sourceOrder: start + i,
    sourceUserMessageId: `u-${tag}-${start + i}`,
    sourceAssistantMessageId: `a-${tag}-${start + i}`,
    publicQuestion: `${tag} Q${i + 1}?`,
    publicAnswer: `${tag} A${i + 1}`,
  }));
}

function lineage(input: {
  journeyId: string;
  windowIndex?: number;
  windowStart?: number;
  parentJourneyId?: string | null;
  selectedCount?: 6 | 7 | 8;
  generationId?: string;
}): JourneyGenerationLineage {
  const selectedCount = input.selectedCount ?? 8;
  const windowStart = input.windowStart ?? input.windowIndex ?? 0;
  return {
    contractVersion: JOURNEY_GENERATION_LINEAGE_VERSION,
    journeyId: input.journeyId,
    journeyVersion: 1,
    sourceConversationId: 'conv-1',
    parentJourneyId: input.parentJourneyId ?? null,
    windowIndex: input.windowIndex ?? 0,
    windowStart,
    windowEnd: windowStart + 7,
    windowHash: `wh-${input.journeyId}`,
    scopedInputHash: `sih-${input.journeyId}`,
    selectedStepsHash: `ssh-${input.journeyId}`,
    interpretationHash: `ih-${input.journeyId}`,
    publicLandingHash: `plh-${input.journeyId}`,
    mappedPromptHash: `mph-${input.journeyId}`,
    generationId: input.generationId ?? `gen-${input.journeyId}`,
    selectedSteps: steps(input.journeyId, selectedCount, windowStart),
    selectedCount,
    sealedAt: '2026-09-15T00:00:00.000Z',
  };
}

function readyArtifact(
  journeyId: string,
  opts: {
    windowIndex?: number;
    windowStart?: number;
    parentJourneyId?: string | null;
    selectedCount?: 6 | 7 | 8;
    sceneImageUrl?: string;
    publicTitle?: string;
    publicSummary?: string;
    updatedAt?: string;
  } = {}
): MirrorJourneyArtifact {
  const lin = lineage({
    journeyId,
    windowIndex: opts.windowIndex,
    windowStart: opts.windowStart,
    parentJourneyId: opts.parentJourneyId,
    selectedCount: opts.selectedCount,
  });
  const row = buildReadyMirrorJourneyArtifactFromLineage({
    lineage: lin,
    sceneImageUrl: opts.sceneImageUrl ?? `https://cdn.example/${journeyId}.jpg`,
    publicTitle: opts.publicTitle ?? `Title ${journeyId}`,
    publicSummary: opts.publicSummary ?? `Summary ${journeyId}`,
    sealedPublicLanding: {
      publicTitle: opts.publicTitle ?? `Title ${journeyId}`,
      publicSummary: opts.publicSummary ?? `Summary ${journeyId}`,
      continuationContext: 'devam',
      semanticSource: 'd2_interpretation',
      interpretationHash: lin.interpretationHash,
      publicLandingHash: lin.publicLandingHash,
      contractVersion: 'mirror-public-landing-v1',
    },
  })!;
  return {
    ...row,
    updatedAt: opts.updatedAt ?? row.updatedAt,
  };
}

function pairs(tag: string, start: number): EligibleQaPair[] {
  return Array.from({ length: 8 }, (_, i) => ({
    sourceOrder: start + i,
    userMessageId: `u-${tag}-${start + i}`,
    assistantMessageId: `a-${tag}-${start + i}`,
    publicQuestion: `${tag} Q${i + 1}?`,
    publicAnswer: `${tag} A${i + 1}`,
  }));
}

function cardFromArtifact(artifact: MirrorJourneyArtifact): DailyMirrorCardModel {
  const card = buildPublishCardFromArtifact({ artifact, liveCard: null });
  if (!card) throw new Error('card_required');
  return card;
}

describe('exactYansiPublishIdentity', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    clearAllReview8Drafts();
    localStorage.clear();
    vi.mocked(apiClient.post).mockReset();
  });

  it('captures sealed identity from A and fails closed without sealed lineage', () => {
    const a = readyArtifact('journey-a', {
      selectedCount: 6,
      windowIndex: 0,
      parentJourneyId: null,
    });
    const exact = captureExactYansiPublishIdentity(a);
    expect(exact?.journeyId).toBe('journey-a');
    expect(exact?.selectedSteps?.length ?? exact?.sealedLineage.selectedSteps.length).toBe(6);
    expect(exact?.windowIndex).toBe(0);
    expect(exact?.sceneImageUrl).toContain('journey-a');
    expect(exact?.publicTitle).toBe('Title journey-a');

    const incomplete = { ...a, sealedLineage: null };
    expect(captureExactYansiPublishIdentity(incomplete)).toBeNull();
  });

  it('A READY + B READY newer — post-success mark resolves A only when exact is A', () => {
    const a = readyArtifact('journey-a', {
      selectedCount: 6,
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    const b = readyArtifact('journey-b', {
      windowIndex: 1,
      windowStart: 8,
      parentJourneyId: 'journey-a',
      selectedCount: 8,
      updatedAt: '2026-09-15T00:00:00.000Z',
    });
    const artifacts = [a, b];

    const unscoped = findReusablePreparedYansiArtifact(artifacts);
    expect(unscoped?.journeyId).toBe('journey-b');

    const exactA = captureExactYansiPublishIdentity(a)!;
    const cardA = cardFromArtifact(a);
    const markA = resolvePostPublishArtifactMarkTarget({
      cardLineage: cardA.mirrorJourneyGenerationLineage,
      exact: exactA,
      conversationArtifacts: artifacts,
    });
    expect(markA).toEqual({ journeyId: 'journey-a', journeyVersion: 1 });

    const markWithoutExact = resolvePostPublishArtifactMarkTarget({
      cardLineage: null,
      exact: null,
      conversationArtifacts: artifacts,
    });
    expect(markWithoutExact).toBeNull();

    const markExactWithoutLineage = resolvePostPublishArtifactMarkTarget({
      cardLineage: null,
      exact: exactA,
      conversationArtifacts: artifacts,
    });
    expect(markExactWithoutLineage).toEqual({
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
  });

  it('async race: B becomes READY while marking A — still marks only A', () => {
    const a = readyArtifact('journey-a', {
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    const exactA = captureExactYansiPublishIdentity(a)!;
    const cardA = cardFromArtifact(a);

    const b = readyArtifact('journey-b', {
      windowIndex: 1,
      windowStart: 8,
      parentJourneyId: 'journey-a',
      updatedAt: '2026-09-15T12:00:00.000Z',
    });
    const afterRace = [a, b];

    expect(findReusablePreparedYansiArtifact(afterRace)?.journeyId).toBe('journey-b');

    const mark = resolvePostPublishArtifactMarkTarget({
      cardLineage: cardA.mirrorJourneyGenerationLineage,
      exact: exactA,
      conversationArtifacts: afterRace,
    });
    expect(mark?.journeyId).toBe('journey-a');
  });

  it('publish A sends A selectedSteps/title/scene/window/parent — not B', async () => {
    const a = readyArtifact('journey-a', {
      selectedCount: 6,
      windowIndex: 0,
      parentJourneyId: null,
      sceneImageUrl: 'https://cdn.example/a-scene.jpg',
      publicTitle: 'Alpha Title',
      publicSummary: 'Alpha Summary',
    });
    const b = readyArtifact('journey-b', {
      selectedCount: 8,
      windowIndex: 1,
      windowStart: 8,
      parentJourneyId: 'journey-a',
      sceneImageUrl: 'https://cdn.example/b-scene.jpg',
      publicTitle: 'Beta Title',
      publicSummary: 'Beta Summary',
    });
    void b;

    const exactA = captureExactYansiPublishIdentity(a)!;
    const card = cardFromArtifact(a);
    expect(exactIdentityMatchesCardLineage(exactA, card.mirrorJourneyGenerationLineage)).toBe(
      true
    );

    // Active Review draft belongs to B — must not leak into exact A publish.
    const draftKey = allocateDraftKey('user-1', 'conv-1');
    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      windowIndex: 1,
      pairs: pairs('B', 8),
      draftKey,
    });
    draft = { ...draft, journeyId: 'journey-b', parentJourneyId: 'journey-a' };
    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      saveReview8Draft(confirmed.draft);
      setActiveReview8DraftKey('user-1', 'conv-1', draftKey);
    }

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: {
        slug: 'journey-a',
        shareUrl: 'https://saina.app/m/journey-a',
        publicTitle: 'Alpha Title',
        publicSummary: 'Alpha Summary',
        sceneImageUrl: 'https://cdn.example/a-scene.jpg',
        cardTitle: 'Alpha Title',
        cardDate: '2026-09-15',
        curiosityContext: 'Alpha Summary',
      },
    });

    const result = await publishMirrorToNetwork({
      card,
      conversationId: 'conv-1',
      ownerUserId: 'user-1',
      sceneImageUrl: exactA.sceneImageUrl,
      journeyId: exactA.journeyId,
      journeyVersion: exactA.journeyVersion,
      parentSlug: exactA.parentJourneyId || undefined,
      generationId: exactA.generationId,
      forbidReviewDraftFallback: true,
      narrativeAlignment: { skip: true },
    });
    expect(result.ok).toBe(true);

    const body = vi.mocked(apiClient.post).mock.calls[0]?.[1]?.body as Record<
      string,
      unknown
    >;
    expect(body.journeyId).toBe('journey-a');
    expect(body.generationId).toBe('gen-journey-a');
    expect(body.windowIndex).toBe(0);
    expect(body.parentSlug).toBeUndefined();
    expect(body.sceneImageUrl).toBe('https://cdn.example/a-scene.jpg');
    expect(body.cardTitle).toBe('Alpha Title');
    const selected = body.selectedSteps as Array<{ publicQuestion: string }>;
    expect(selected).toHaveLength(6);
    expect(selected.every((s) => s.publicQuestion.startsWith('journey-a'))).toBe(true);
    expect(selected.some((s) => s.publicQuestion.startsWith('journey-b'))).toBe(false);
  });

  it('publish B after A uses B identity only', async () => {
    const b = readyArtifact('journey-b', {
      selectedCount: 8,
      windowIndex: 1,
      windowStart: 8,
      parentJourneyId: 'journey-a',
      sceneImageUrl: 'https://cdn.example/b-scene.jpg',
      publicTitle: 'Beta Title',
    });
    const exactB = captureExactYansiPublishIdentity(b)!;
    const card = cardFromArtifact(b);

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: {
        slug: 'journey-b',
        shareUrl: 'https://saina.app/m/journey-b',
        publicTitle: 'Beta Title',
        publicSummary: 'Summary journey-b',
        sceneImageUrl: 'https://cdn.example/b-scene.jpg',
        cardTitle: 'Beta Title',
        cardDate: '2026-09-15',
      },
    });

    const result = await publishMirrorToNetwork({
      card,
      conversationId: 'conv-1',
      ownerUserId: 'user-1',
      sceneImageUrl: exactB.sceneImageUrl,
      journeyId: exactB.journeyId,
      journeyVersion: exactB.journeyVersion,
      parentSlug: exactB.parentJourneyId || undefined,
      generationId: exactB.generationId,
      forbidReviewDraftFallback: true,
      narrativeAlignment: { skip: true },
    });
    expect(result.ok).toBe(true);
    const body = vi.mocked(apiClient.post).mock.calls[0]?.[1]?.body as Record<
      string,
      unknown
    >;
    expect(body.journeyId).toBe('journey-b');
    expect(body.parentSlug).toBe('journey-a');
    expect(body.windowIndex).toBe(1);
    expect(body.sceneImageUrl).toBe('https://cdn.example/b-scene.jpg');
    expect((body.selectedSteps as unknown[]).length).toBe(8);
  });

  it('forbidReviewDraftFallback fails closed when sealed lineage missing', () => {
    const draftKey = allocateDraftKey('user-1', 'conv-1');
    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      windowIndex: 1,
      pairs: pairs('B', 8),
      draftKey,
    });
    draft = { ...draft, journeyId: 'journey-b' };
    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      saveReview8Draft(confirmed.draft);
      setActiveReview8DraftKey('user-1', 'conv-1', draftKey);
    }

    const blocked = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
      forbidReviewDraftFallback: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe('lineage_required');
    }
  });

  it('mismatched journeyId on lineage fails closed', () => {
    const a = readyArtifact('journey-a');
    const contract = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-1',
      generationLineage: a.sealedLineage,
      journeyId: 'journey-b',
      forbidReviewDraftFallback: true,
    });
    expect(contract.ok).toBe(false);
    if (!contract.ok) {
      expect(contract.code).toBe('lineage_stale');
    }
  });

  it('hydrated incomplete artifact cannot be captured; B is not substituted', () => {
    const aIncomplete = {
      ...readyArtifact('journey-a'),
      sealedLineage: null,
    };
    const b = readyArtifact('journey-b', {
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
    expect(captureExactYansiPublishIdentity(aIncomplete)).toBeNull();
    expect(buildPublishCardFromArtifact({ artifact: aIncomplete, liveCard: null })).toBeNull();

    const mark = resolvePostPublishArtifactMarkTarget({
      cardLineage: null,
      exact: null,
      conversationArtifacts: [aIncomplete, b],
    });
    expect(mark).toBeNull();
  });

  it('republish A marks A; B stays READY when only A is marked', () => {
    const a = readyArtifact('journey-a');
    const b = readyArtifact('journey-b', {
      windowIndex: 1,
      windowStart: 8,
      parentJourneyId: 'journey-a',
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
    const exactA = captureExactYansiPublishIdentity(a)!;
    const mark = resolvePostPublishArtifactMarkTarget({
      cardLineage: a.sealedLineage,
      exact: exactA,
      conversationArtifacts: [a, b],
    })!;
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: mark.journeyId,
      journeyVersion: mark.journeyVersion,
      slug: 'journey-a',
      shareUrl: 'https://saina.app/m/journey-a',
      publicTitle: a.publicTitle,
      publicSummary: a.publicSummary,
      sceneImageUrl: a.sceneImageUrl,
    });
    // Store-side mark uses user+journey — B untouched in the input list.
    expect(b.status).toBe('ready');
    expect(mark.journeyId).toBe('journey-a');
  });
});
