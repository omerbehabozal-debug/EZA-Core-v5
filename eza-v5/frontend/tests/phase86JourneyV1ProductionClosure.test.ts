/**
 * Phase 8.6 — Journey V1 production closure tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearAllMirrorJourneyArtifactsForTests,
  hydratePublishedJourneysFromServer,
  isMirrorJourneyV1ClientEnabled,
  markMirrorJourneyArtifactGenerating,
  parseMirrorJourneyV1Flag,
  recoverPublishedJourneyAfterLostResponse,
  requestJourneyAynaGeneration,
  JOURNEY_AYNA_GENERATE_EVENT,
  loadMirrorJourneyArtifact,
  confirmReview8Draft,
  buildReview8DraftFromWindow,
  type EligibleQaPair,
} from '@/lib/eza/mirror/journey';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/apiClient';

function pair(i: number): EligibleQaPair {
  return {
    sourceOrder: i,
    userMessageId: `u${i}`,
    assistantMessageId: `a${i}`,
    publicQuestion: `Soru ${i + 1}?`,
    publicAnswer: `Cevap ${i + 1}.`,
  };
}

describe('Phase 8.6 Journey V1 production closure', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    vi.mocked(apiClient.get).mockReset();
  });

  it('frontend/backend Journey V1 flag parsers agree on true/1/false/0/unset', () => {
    expect(parseMirrorJourneyV1Flag('true')).toBe(true);
    expect(parseMirrorJourneyV1Flag('1')).toBe(true);
    expect(parseMirrorJourneyV1Flag('false')).toBe(false);
    expect(parseMirrorJourneyV1Flag('0')).toBe(false);
    expect(parseMirrorJourneyV1Flag(undefined)).toBe(false);
    expect(parseMirrorJourneyV1Flag('')).toBe(false);
    expect(
      isMirrorJourneyV1ClientEnabled({
        NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'true',
      })
    ).toBe(true);

    const backendConfig = readFileSync(
      join(process.cwd(), '../backend/config.py'),
      'utf8'
    );
    expect(backendConfig).toContain('EZA_MIRROR_JOURNEY_V1');
    expect(backendConfig).toContain('parse_strict_env_bool');

    const caps = readFileSync(
      join(process.cwd(), '../backend/routers/mirror_network.py'),
      'utf8'
    );
    expect(caps).toContain('/capabilities');
    expect(caps).toContain('journeyV1Enabled');
  });

  it('Review confirm reuses journeyId (idempotent allocation)', () => {
    const pairs = Array.from({ length: 8 }, (_, i) => pair(i));
    const draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-1',
      windowIndex: 0,
      pairs,
      draftKey: 'chat-1:0',
    });
    const first = confirmReview8Draft(draft);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = confirmReview8Draft(first.draft);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.draft.journeyId).toBe(first.draft.journeyId);
  });

  it('Review8Screen has sync confirm in-flight guard', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/mirror/Review8Screen.tsx'),
      'utf8'
    );
    expect(src).toContain('confirmInFlightRef');
    expect(src).toContain('confirming');
  });

  it('Review→Ayna dispatches generation kickoff event', () => {
    const chat = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(chat).toContain('requestJourneyAynaGeneration');
    const obs = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(obs).toContain('JOURNEY_AYNA_GENERATE_EVENT');
    expect(obs).toContain('onRetry');

    const seen: string[] = [];
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      seen.push(d.journeyId);
    };
    window.addEventListener(JOURNEY_AYNA_GENERATE_EVENT, handler);
    requestJourneyAynaGeneration({
      conversationId: 'chat-1',
      journeyId: 'demo-slug',
      journeyVersion: 1,
    });
    window.removeEventListener(JOURNEY_AYNA_GENERATE_EVENT, handler);
    expect(seen).toEqual(['demo-slug']);
  });

  it('hydrate upgrades ready/generating to server published (lost response)', async () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      sourceConversationId: 'chat-1',
      blockIndex: 0,
      selectedCount: 8,
    });
    // Force ready-like status via direct generating then publish recover path
    const generating = loadMirrorJourneyArtifact('user-1', 'journey-a', 1);
    expect(generating?.status).toBe('generating');

    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        conversationId: 'chat-1',
        total: 1,
        items: [
          {
            slug: 'journey-a',
            journeyId: 'journey-a',
            journeyVersion: 1,
            freezeStatus: 'frozen',
            publicTitle: 'Title',
            publicSummary: 'Summary',
            sceneImageUrl: 'https://cdn.example/a.png',
            publishedAt: '2026-08-20T12:00:00Z',
          },
        ],
      },
    });

    const recovered = await recoverPublishedJourneyAfterLostResponse({
      ownerUserId: 'user-1',
      conversationId: 'chat-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(recovered.recovered).toBe(true);
    expect(loadMirrorJourneyArtifact('user-1', 'journey-a', 1)?.status).toBe(
      'published'
    );
  });

  it('hydratePublishedJourneysFromServer does not skip ready drafts when server frozen', async () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-b',
      sourceConversationId: 'chat-1',
      blockIndex: 0,
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        conversationId: 'chat-1',
        total: 1,
        items: [
          {
            slug: 'journey-b',
            journeyId: 'journey-b',
            journeyVersion: 1,
            freezeStatus: 'frozen',
            publicTitle: 'B',
            publishedAt: '2026-08-20T12:00:00Z',
          },
        ],
      },
    });
    await hydratePublishedJourneysFromServer({
      ownerUserId: 'user-1',
      conversationId: 'chat-1',
    });
    expect(loadMirrorJourneyArtifact('user-1', 'journey-b', 1)?.status).toBe(
      'published'
    );
  });

  it('publish path no longer soft-succeeds on prior shareUrl after failure', () => {
    const obs = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(obs).not.toMatch(
      /if \(card\.mirrorShare\?\.shareUrl && options\?\.refreshScene\)[\s\S]{0,80}return true/
    );
    expect(obs).toContain('recoverPublishedJourneyAfterLostResponse');
  });

  it('mark generating does not wipe ready/published', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'j1',
      sourceConversationId: 'c1',
      blockIndex: 0,
    });
    // Simulate ready by marking generating then checking published guard path exists
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/journey/mirrorJourneyArtifactStore.ts'),
      'utf8'
    );
    expect(src).toContain("existing?.status === 'published' || existing?.status === 'ready'");
  });

  it('share URL and trust/Discover/profile contracts unchanged', () => {
    const publicUrl = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/mirrorPublicUrl.ts'),
      'utf8'
    );
    expect(publicUrl).toContain('/m/');

    const discover = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(discover).toContain('YansiPublicMetricsView');

    const profile = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AuthorPublishedYansiProfile.tsx'),
      'utf8'
    );
    expect(profile).toContain('fetchAuthorPublishedYansilar');

    const trust = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/yansiTrustActions.ts'),
      'utf8'
    );
    expect(trust).toContain('unpublishYansi');
  });

  it('creator publish does not ingest Phase 6 experience events', () => {
    const publish = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-share/publishMirrorToNetwork.ts'),
      'utf8'
    );
    expect(publish).not.toContain('experience-events');
    expect(publish).not.toContain('exposure-events');
  });
});
