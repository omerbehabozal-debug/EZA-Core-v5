/**
 * Stage 04D — V2 in-place live continuation (public /answer), not V1 /sohbet.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  answerYansiV2Public,
  parseYansiV2AnswerResponse,
} from '@/lib/eza/mirror/journey/answerYansiV2Public';
import { mapV2PublicToFrozenArtifact } from '@/lib/eza/mirror/journey/mapV2PublicToFrozenArtifact';
import { parseYansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import YansiDesktopExperience from '@/components/mirror-landing/YansiDesktopExperience';
import YansiReelExperienceInvite from '@/components/mirror-landing/YansiReelExperienceInvite';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { createRef } from 'react';

const BIZ = '11111111-1111-1111-1111-111111111111';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const coverPath = `/api/business-yansi/public-media/${BIZ}/${ASSET}`;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/components/mirror-landing/YansiExperienceSession', () => ({
  useYansiExperienceSession: () => null,
}));

vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({
  createMirrorSohbetSession: vi.fn(async () => ({
    ok: false,
    code: 'frozen_journey_not_found',
  })),
  personalChatStartError: () => 'V1 sohbet yok',
}));

vi.mock('@/lib/eza/mirror-network/mirrorGuestConversation', () => ({
  startMirrorGuestChat: vi.fn(),
  MIRROR_GUEST_CHAT_REPLY_PARAM: 'mirrorReply',
}));

vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({
  trackSeedStart: vi.fn(),
  trackGuestConversationStarted: vi.fn(),
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => true,
}));

function conversationPub() {
  return parseYansiV2PublicPublication({
    status: 'ok',
    slug: 'v2-live',
    publicationVersion: 4,
    isCurrent: true,
    contentKind: 'conversation',
    businessPublisher: {
      businessId: BIZ,
      slug: 'demo',
      displayName: 'Demo',
      logoUrl: null,
      verified: true,
      official: true,
    },
    public: {
      slug: 'v2-live',
      conversation: {
        turnCount: 1,
        curiosityQuestion: 'Merak?',
        turns: [
          {
            stepIndex: 1,
            question: 'Merak?',
            answer: 'Frozen cevap.',
            media: [],
          },
        ],
      },
      cover: { assetId: ASSET, title: 'Kapak', contentPath: coverPath },
    },
  });
}

describe('04D answer client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pins publicationVersion and rejects silent version drift', () => {
    const ok = parseYansiV2AnswerResponse(
      {
        status: 'ok',
        assistant_answer: 'Canlı cevap',
        publicationVersion: 4,
        slug: 'v2-live',
        sources: [],
      },
      4
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.publicationVersion).toBe(4);

    const drift = parseYansiV2AnswerResponse(
      {
        assistant_answer: 'x',
        publicationVersion: 5,
        slug: 'v2-live',
      },
      4
    );
    expect(drift.ok).toBe(false);
    if (!drift.ok) expect(drift.code).toBe('publication_version_mismatch');
  });

  it('POSTs pinned version + history and never invents bundle overrides', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      expect(body.publicationVersion).toBe(4);
      expect(body.bundleId).toBeUndefined();
      expect(body.history).toEqual([
        { role: 'user', content: 'Merak?' },
        { role: 'assistant', content: 'Frozen cevap.' },
      ]);
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          assistant_answer: 'Canlı cevap',
          publicationVersion: 4,
          slug: 'v2-live',
          sources: [],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await answerYansiV2Public({
      slug: 'v2-live',
      publicationVersion: 4,
      question: 'Yeni soru?',
      history: [
        { role: 'user', content: 'Merak?' },
        { role: 'assistant', content: 'Frozen cevap.' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/business-yansi/v2/public/v2-live/answer'
    );
  });
});

describe('04D mapper + invite', () => {
  it('enables live continuation for conversation and image', () => {
    const conv = mapV2PublicToFrozenArtifact(conversationPub()!);
    expect(conv?.liveContinuationAvailable).toBe(true);
    expect(conv?.journeyVersion).toBe(4);

    const image = mapV2PublicToFrozenArtifact(
      parseYansiV2PublicPublication({
        status: 'ok',
        slug: 'v2-photo',
        publicationVersion: 2,
        isCurrent: true,
        contentKind: 'image',
        public: {
          slug: 'v2-photo',
          media: { assetId: ASSET, contentPath: coverPath, title: 'Foto' },
        },
      })!
    );
    expect(image?.liveContinuationAvailable).toBe(true);
    expect(image?.steps).toEqual([]);
  });

  it('offers image-only chat open without inventing frozen Q/A', () => {
    const artifact: PublicFrozenJourneyArtifact = {
      slug: 'photo',
      journeyId: 'photo',
      journeyVersion: 2,
      authorUserId: BIZ,
      replayReady: true,
      selectedCount: 0,
      steps: [],
      sourceKind: 'v2_publication',
      contentKind: 'image',
      liveContinuationAvailable: true,
    };
    const onOpenChat = vi.fn();
    render(<YansiReelExperienceInvite artifact={artifact} onOpenChat={onOpenChat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Soru sor' }));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Görsel Yansı')).toBeInTheDocument();
  });
});

describe('04D desktop V2 composer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers in place without calling V1 sohbet session', async () => {
    const { createMirrorSohbetSession } = await import(
      '@/lib/eza/mirror-network/createSohbetSession'
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'ok',
        assistant_answer: 'Canlı cevap metni',
        publicationVersion: 4,
        slug: 'v2-live',
        sources: [],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const scrollRef = createRef<HTMLDivElement>();
    render(
      <YansiDesktopExperience
        slug="v2-live"
        identity={{
          title: 'Merak?',
          displayName: 'Demo',
          authorUserId: BIZ,
          avatarUrl: null,
          honorific: null,
          timeLabel: null,
          businessLabel: 'Business',
        }}
        messages={<div data-testid="frozen-only">Frozen cevap.</div>}
        replayAction={null}
        scrollRef={scrollRef}
        replaySelection={{ slug: 'v2-live', journeyVersion: 4, completedStepCount: 1 }}
        allowPersonalContinue
        v2Continuation={{
          publicationVersion: 4,
          seedHistory: [
            { role: 'user', content: 'Merak?' },
            { role: 'assistant', content: 'Frozen cevap.' },
          ],
        }}
      />
    );

    expect(screen.getByTestId('yansi-desktop-experience')).toHaveAttribute(
      'data-yansi-continuation',
      'v2_public_answer'
    );
    expect(screen.getByTestId('yansi-desktop-experience')).toHaveAttribute(
      'data-yansi-publication-version',
      '4'
    );

    const input = screen.getByPlaceholderText(/Merak|mesaj|devam/i);
    fireEvent.change(input, { target: { value: 'Yeni soru?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('yansi-v2-live-thread')).toBeInTheDocument();
      expect(screen.getByText('Canlı cevap metni')).toBeInTheDocument();
    });
    expect(screen.getByTestId('frozen-only')).toHaveTextContent('Frozen cevap.');
    expect(createMirrorSohbetSession).not.toHaveBeenCalled();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    expect(body.publicationVersion).toBe(4);
    expect(body.question).toBe('Yeni soru?');
  });

  it('keeps V1 path when v2Continuation is absent', async () => {
    const { createMirrorSohbetSession } = await import(
      '@/lib/eza/mirror-network/createSohbetSession'
    );
    vi.mocked(createMirrorSohbetSession).mockClear();
    const scrollRef = createRef<HTMLDivElement>();
    render(
      <YansiDesktopExperience
        slug="v1-yansi"
        identity={{
          title: 'V1',
          displayName: 'User',
          authorUserId: 'u1',
          avatarUrl: null,
          honorific: null,
          timeLabel: null,
        }}
        messages={<div>v1</div>}
        replayAction={null}
        scrollRef={scrollRef}
        replaySelection={{ slug: 'v1-yansi', journeyVersion: 2, completedStepCount: 6 }}
        allowPersonalContinue
      />
    );
    expect(screen.getByTestId('yansi-desktop-experience')).toHaveAttribute(
      'data-yansi-continuation',
      'v1_sohbet'
    );
    const input = screen.getByPlaceholderText(/Merak|mesaj|devam/i);
    fireEvent.change(input, { target: { value: 'devam' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(createMirrorSohbetSession).toHaveBeenCalled());
  });
});
