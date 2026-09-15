/**
 * Authenticated Saina conversation: real Yansı only via Journey → Review8 → confirm.
 * Gates legacy DailyMirrorCreatePrompt / Mirror Birth early-create bypass.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReview8DraftFromWindow,
  clearAllMirrorJourneyArtifactsForTests,
  clearAllReview8Drafts,
  confirmReview8Draft,
  canAuthorizeAuthenticatedJourneyMirrorReveal,
  getAwaitingDecisionWindow,
  getEarlyYansiReviewWindowIndex,
  hasJourneyBackedYansiArtifact,
  JOURNEY_AYNA_GENERATE_EVENT,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  requestJourneyAynaGeneration,
  requiresAuthenticatedJourneyYansiGate,
  syncJourneyConversationState,
  type EligibleQaPair,
  type JourneyGenerationLineage,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import {
  bootstrapServerConversations,
  getServerConversationSummaries,
  promoteServerConversationIdentityFromYansi,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  captureYansiPreparationAuthority,
  persistAuthenticatedReadyYansi,
} from '@/lib/eza/mirror/journey/persistAuthenticatedReadyYansi';

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

const sceneDurable = 'https://api.ezacore.ai/api/public/mirror-scene-assets/a.png';
const sceneX = 'https://api.ezacore.ai/api/public/mirror-scene-assets/x.png';
const sceneY = 'https://api.ezacore.ai/api/public/mirror-scene-assets/y.png';

function pairMessages(n: number): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: `u${i}`,
      text: `Soru ${i + 1} neden böyle?`,
      role: 'user',
    });
    out.push({
      id: `a${i}`,
      text: `Cevap ${i + 1} tamamlanmış ve yeterli.`,
      role: 'assistant',
    });
  }
  return out;
}

function eligiblePairs(n: number): EligibleQaPair[] {
  return Array.from({ length: n }, (_, i) => ({
    sourceOrder: i,
    userMessageId: `u${i}`,
    assistantMessageId: `a${i}`,
    publicQuestion: `Soru ${i + 1}?`,
    publicAnswer: `Cevap ${i + 1}.`,
  }));
}

function lineage(tag = 'alpha', conv = 'chat-auth'): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: 1,
    sourceConversationId: conv,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    windowHash: `win-${tag}`,
    scopedInputHash: `scoped-${tag}`,
    selectedStepsHash: `steps-${tag}`,
    interpretationHash: `interp-${tag}`,
    publicLandingHash: `land-${tag}`,
    mappedPromptHash: `map-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `asset-${tag}`,
    sealedAt: '2026-09-03T00:00:00.000Z',
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i,
      sourceOrder: i,
      sourceUserMessageId: `u-${i}`,
      sourceAssistantMessageId: `a-${i}`,
      publicQuestion: `Soru ${i}`,
      publicAnswer: `Yanıt ${i}`,
    })),
  };
}

const listAuth = {
  id: 'srv-auth',
  clientConversationId: 'chat-auth',
  title: 'First message title',
  preview: '',
  conversationType: 'direct' as const,
  messageCount: 16,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastMessageAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
  hasReadyYansi: false,
  publishedYansiSlug: null as string | null,
  yansiIdentityGenerationId: null as string | null,
};

const obsSrc = () =>
  readFileSync(
    join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
    'utf8'
  );
const chatSrc = () =>
  readFileSync(join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'), 'utf8');

describe('Authenticated Journey Yansı gate', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    clearAllReview8Drafts();
    localStorage.clear();
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
    apiMocks.listServerConversations.mockResolvedValue([listAuth]);
    apiMocks.putServerYansiPreparation.mockResolvedValue({
      id: 'prep-1',
      conversationId: 'srv-auth',
      sourceIdentity: 'journey-alpha::v1',
      journeyId: 'journey-alpha',
      journeyVersion: 1,
      windowIndex: 0,
      windowHash: 'win-alpha',
      selectedStepsHash: 'steps-alpha',
      generationId: 'gen-alpha',
      status: 'ready',
      publicTitle: 'Title Alpha',
      publicSummary: 'Summary Alpha',
      sceneImageUrl: sceneDurable,
      sceneAssetId: 'asset-alpha',
      sealedLineage: lineage() as unknown as Record<string, unknown>,
      sealedPublicLanding: {
        publicTitle: 'Title Alpha',
        publicSummary: 'Summary Alpha',
      },
      publishedSlug: null,
      createdAt: '2026-09-03T00:00:00.000Z',
    });
    apiMocks.patchServerConversation.mockImplementation(async (_id, patch) => ({
      ...listAuth,
      ...patch,
      titlePinned: Boolean(patch.titlePinned ?? listAuth.titlePinned),
      hasReadyYansi: true,
      yansiIdentityGenerationId:
        patch.yansiIdentityGenerationId ?? listAuth.yansiIdentityGenerationId ?? null,
    }));
  });

  it('gate is on for authenticated + invitation (including pending chat)', () => {
    expect(
      requiresAuthenticatedJourneyYansiGate({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
      })
    ).toBe(true);
    expect(
      requiresAuthenticatedJourneyYansiGate({
        isAuthenticated: true,
        conversationId: '',
        invitationEnabled: true,
      })
    ).toBe(true);
    expect(
      requiresAuthenticatedJourneyYansiGate({
        isAuthenticated: true,
        conversationId: null,
        invitationEnabled: true,
      })
    ).toBe(true);
    expect(
      requiresAuthenticatedJourneyYansiGate({
        isAuthenticated: false,
        conversationId: 'chat-1',
        invitationEnabled: true,
      })
    ).toBe(false);
    expect(
      requiresAuthenticatedJourneyYansiGate({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: false,
      })
    ).toBe(false);
  });

  it('A: 1–5 eligible Q/A do not open awaiting_decision or early Review', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const state = syncJourneyConversationState({
        state: null,
        ownerUserId: 'user-1',
        sourceConversationId: 'chat-auth',
        messages: pairMessages(n),
      });
      expect(state.eligiblePairCount).toBe(n);
      expect(getAwaitingDecisionWindow(state)).toBeNull();
      expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    }
  });

  it('B2: Review draft accepts 6-pair early source block', () => {
    const pairs = eligiblePairs(6);
    const draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      windowIndex: 0,
      pairs,
      draftKey: 'early-6',
    });
    expect(draft.sourceBlockSteps).toHaveLength(6);
    expect(draft.selectedSteps).toHaveLength(6);
    expect(confirmReview8Draft(draft).ok).toBe(true);
  });

  it('B: 6 eligible Q/A enable early Yansı Review (no generation yet)', () => {
    const state = syncJourneyConversationState({
      state: null,
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      messages: pairMessages(6),
    });
    expect(state.eligiblePairCount).toBe(6);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(getEarlyYansiReviewWindowIndex(state)).toBe(0);
  });

  it('C: Review8 confirm requires 6–8 selections (5 blocked)', () => {
    const pairs = eligiblePairs(8);
    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      windowIndex: 0,
      pairs,
    });
    draft = {
      ...draft,
      selectedSourceOrders: [0, 1, 2, 3, 4],
      selectedSteps: pairs.slice(0, 5),
    };
    expect(confirmReview8Draft(draft).ok).toBe(false);

    draft = {
      ...draft,
      selectedSourceOrders: [0, 1, 2, 3, 4, 5],
      selectedSteps: pairs.slice(0, 6),
    };
    expect(confirmReview8Draft(draft).ok).toBe(true);

    draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      windowIndex: 0,
      pairs,
    });
    expect(confirmReview8Draft(draft).ok).toBe(true);
  });

  it('E: excluded exchange is absent from confirmed generation payload', () => {
    const pairs = eligiblePairs(8);
    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      windowIndex: 0,
      pairs,
    });
    // Exclude sourceOrder 2 (bad exchange)
    draft = {
      ...draft,
      selectedSourceOrders: [0, 1, 3, 4, 5, 6],
      selectedSteps: [pairs[0], pairs[1], pairs[3], pairs[4], pairs[5], pairs[6]],
    };
    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    const orders = confirmed.draft.selectedSteps.map((s) => s.sourceOrder);
    expect(orders).toEqual([0, 1, 3, 4, 5, 6]);
    expect(orders).not.toContain(2);
  });

  it('F: 8 eligible Q/A produce awaiting_decision (create + continue)', () => {
    const state = syncJourneyConversationState({
      state: null,
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      messages: pairMessages(8),
    });
    expect(state.eligiblePairCount).toBe(8);
    expect(getAwaitingDecisionWindow(state)?.status).toBe('awaiting_decision');
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
  });

  it('G: legacy reveal unauthorized without Review kick for authenticated', () => {
    expect(
      canAuthorizeAuthenticatedJourneyMirrorReveal({
        isAuthenticated: true,
        conversationId: 'chat-auth',
        ownerUserId: 'user-1',
        journeyAuthorizedReveal: false,
        invitationEnabled: true,
      })
    ).toBe(false);
    expect(
      canAuthorizeAuthenticatedJourneyMirrorReveal({
        isAuthenticated: true,
        conversationId: 'chat-auth',
        ownerUserId: 'user-1',
        journeyAuthorizedReveal: true,
        invitationEnabled: true,
      })
    ).toBe(true);
    expect(
      canAuthorizeAuthenticatedJourneyMirrorReveal({
        isAuthenticated: false,
        conversationId: 'chat-guest',
        ownerUserId: null,
        journeyAuthorizedReveal: false,
        invitationEnabled: true,
      })
    ).toBe(true);
  });

  it('D: confirm → requestJourneyAynaGeneration; sealed ready → persist + promote', async () => {
    const pairs = eligiblePairs(8);
    const draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-auth',
      windowIndex: 0,
      pairs,
    });
    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const seen: string[] = [];
    const handler = (e: Event) => {
      seen.push((e as CustomEvent).detail.journeyId);
    };
    window.addEventListener(JOURNEY_AYNA_GENERATE_EVENT, handler);
    requestJourneyAynaGeneration({
      conversationId: 'chat-auth',
      journeyId: confirmed.draft.journeyId,
      journeyVersion: confirmed.draft.journeyVersion ?? 1,
    });
    window.removeEventListener(JOURNEY_AYNA_GENERATE_EVENT, handler);
    expect(seen).toEqual([confirmed.draft.journeyId]);

    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: confirmed.draft.journeyId,
      journeyVersion: confirmed.draft.journeyVersion ?? 1,
      sourceConversationId: 'chat-auth',
      blockIndex: 0,
      selectedCount: 8,
    });
    const sealed = markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: {
        ...lineage('alpha', 'chat-auth'),
        journeyId: confirmed.draft.journeyId,
        generationId: 'gen-alpha',
      },
      sceneImageUrl: sceneDurable,
      publicTitle: 'Title Alpha',
      publicSummary: 'Summary Alpha',
    });
    expect(sealed?.status).toBe('ready');
    expect(
      hasJourneyBackedYansiArtifact({
        ownerUserId: 'user-1',
        conversationId: 'chat-auth',
      })
    ).toBe(true);

    await bootstrapServerConversations('user-1');
    const bound = captureYansiPreparationAuthority('user-1');
    expect(bound).not.toBeNull();
    const persisted = await persistAuthenticatedReadyYansi({
      artifact: sealed!,
      clientConversationId: 'chat-auth',
      bound: bound!,
      ownerNow: 'user-1',
      sceneFocalX: null,
      sceneFocalY: null,
    });
    expect(apiMocks.putServerYansiPreparation).toHaveBeenCalled();
    expect(persisted?.identityPromotion).toBe('applied');
    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith(
      'srv-auth',
      expect.objectContaining({
        expectedYansiIdentityGenerationId: null,
        yansiIdentityGenerationId: 'gen-alpha',
        title: 'Title Alpha',
      })
    );
  });

  it('E: first promote uses expected=null and sets yansi_identity_generation_id', async () => {
    await bootstrapServerConversations('user-1');
    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...listAuth,
      title: 'Title X',
      titlePinned: true,
      conversationSceneUrl: sceneX,
      hasReadyYansi: true,
      yansiIdentityGenerationId: 'gen-x',
    });
    const x = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-auth',
      title: 'Title X',
      generationId: 'gen-x',
      conversationSceneUrl: sceneX,
      conversationSceneSource: 'mirror_local',
    });
    expect(x).toBe('applied');
    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith(
      'srv-auth',
      expect.objectContaining({
        expectedYansiIdentityGenerationId: null,
        yansiIdentityGenerationId: 'gen-x',
        title: 'Title X',
      })
    );
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-x');
    expect(getServerConversationSummaries()[0]?.title).toBe('Title X');
  });

  it('F: X→Y — stale X cannot overwrite committed Y', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        ...listAuth,
        title: 'Title Y',
        titlePinned: true,
        conversationSceneUrl: sceneY,
        hasReadyYansi: true,
        yansiIdentityGenerationId: 'gen-y',
      },
    ]);
    await bootstrapServerConversations('user-1');

    apiMocks.patchServerConversation.mockResolvedValueOnce({
      ...listAuth,
      title: 'Title Y',
      titlePinned: true,
      conversationSceneUrl: sceneY,
      hasReadyYansi: true,
      yansiIdentityGenerationId: 'gen-y',
    });
    const stale = await promoteServerConversationIdentityFromYansi({
      clientConversationId: 'chat-auth',
      title: 'Title X late',
      generationId: 'gen-x',
      conversationSceneUrl: sceneX,
      conversationSceneSource: 'mirror_local',
    });
    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith(
      'srv-auth',
      expect.objectContaining({
        expectedYansiIdentityGenerationId: 'gen-y',
        yansiIdentityGenerationId: 'gen-x',
      })
    );
    expect(stale).toBe('noop_stale');
    expect(getServerConversationSummaries()[0]?.yansiIdentityGenerationId).toBe('gen-y');
    expect(getServerConversationSummaries()[0]?.title).toBe('Title Y');
  });

  it('source: ObservationExperience blocks legacy create/birth and arms journey kick', () => {
    const obs = obsSrc();
    expect(obs).toContain('requiresAuthenticatedJourneyYansiGate');
    expect(obs).toContain('canAuthorizeAuthenticatedJourneyMirrorReveal');
    expect(obs).toContain('setJourneyAuthorizedReveal(true)');
    expect(obs).toContain('ayna-journey-gated-empty');
    expect(obs).toContain('hasJourneyBackedYansiArtifact');
    const birthIdx = obs.indexOf('onMirrorBirthGenerate');
    const birthGateIdx = obs.indexOf('requiresAuthenticatedJourneyYansiGate', birthIdx);
    const birthHandleIdx = obs.indexOf('handleGenerateDailyMirror()', birthIdx);
    expect(birthGateIdx).toBeGreaterThan(birthIdx);
    expect(birthHandleIdx).toBeGreaterThan(birthGateIdx);
  });

  it('source: ChatInner 8-pair decision opens Review; early create via Ayna bridge', () => {
    const chat = chatSrc();
    expect(chat).toContain('requiresAuthenticatedJourneyYansiGate');
    expect(chat).toContain('requestJourneyAynaGeneration');
    expect(chat).toContain('JourneyWindowDecisionBanner');
    expect(chat).toContain('getEarlyYansiReviewWindowIndex');
    expect(chat).toContain('handleEarlyYansiCreate');
    expect(chat).toContain('EARLY_YANSI_REVIEW_REQUEST_EVENT');
    expect(chat).toContain('awaitingJourneyWindow');
    // Early 6–7 must NOT render the bottom decision banner.
    expect(chat).not.toContain('showSkip={false}');
    const obs = obsSrc();
    expect(obs).toContain('canShowAynaEarlyYansiCreateCta');
    expect(obs).toContain('requestEarlyYansiReview');
    expect(obs).toContain('AynaEarlyYansiCreateCta');
  });

  it('source: ready headline gated; persist path unchanged', () => {
    const obs = obsSrc();
    expect(obs).toContain('journeyAuthorizedReveal');
    expect(obs).toContain('saina-mirror-ready-headline');
    expect(obs).toContain('persistAuthenticatedReadyYansi');
    const persistSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/journey/persistAuthenticatedReadyYansi.ts'),
      'utf8'
    );
    expect(persistSrc).toContain('promoteServerConversationIdentityFromYansi');
  });
});
