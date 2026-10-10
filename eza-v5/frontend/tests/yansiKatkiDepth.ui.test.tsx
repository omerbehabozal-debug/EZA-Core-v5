/**
 * Desktop Katkılar depth. Mobile and the Reel metrics row stay frozen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentProps, ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YansiKatkiDepth, { YansiVerifierPanel } from '@/components/mirror-landing/YansiKatkiDepth';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { apiClient } from '@/lib/apiClient';
import { KATKI_EMPTY_COPY_FORBIDDEN } from '@/lib/eza/mirror-network/katkiPublic';
import type { KatkiType } from '@/lib/eza/mirror-network/katkiDepth';
import { YANSI_WHEEL_COMMIT_PX } from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';
import { YANSI_REEL_TRAVEL_MS } from '@/lib/eza/mirror/journey/yansiDesktopReelTransition';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const flags = vi.hoisted(() => ({
  desktop: true,
  authenticated: true,
}));

const requireAuth = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/m/yansi-b',
}));

vi.mock('@/hooks/useSainaMinWidth', () => ({
  useSainaCompactShell: () => flags.desktop,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: flags.authenticated,
    isAuthReady: true,
    user: flags.authenticated ? { user_id: 'viewer' } : null,
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer')
  >('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer');
  return {
    ...actual,
    fetchPublicFrozenJourneyArtifact: vi.fn(async ({ slug }: { slug: string }) => makeArtifact(slug)),
  };
});

vi.mock('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay')
  >();
  return {
    ...actual,
    resolvePublicAuthorIdentity: async () => ({
      displayName: 'Author',
      publicHonorific: '',
      publicAvatarUrl: null,
      publicAvatarRevision: null,
    }),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchContinuationNeighbors', () => ({
  fetchContinuationNeighbors: vi.fn(async (slug: string) => ({
    ok: true,
    data: { slug, journeyVersion: 2, previous: null, next: null },
  })),
}));

vi.mock('@/lib/eza/mirror-network/fetchDiscoverMirrors', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchDiscoverMirrors')
  >('@/lib/eza/mirror-network/fetchDiscoverMirrors');
  return {
    ...actual,
    fetchDiscoverMirrors: vi.fn(),
  };
});

import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

function makeArtifact(slug: string): PublicFrozenJourneyArtifact {
  return {
    slug,
    journeyId: slug,
    journeyVersion: 2,
    publicTitle: `Canonical ${slug}`,
    publicSummary: `Sealed summary ${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    authorUserId: 'user-b',
    selectedCount: 4,
    steps: [
      { stepIndex: 1, publicQuestion: 'Q1?', publicAnswer: 'A1' },
      { stepIndex: 2, publicQuestion: 'Q2?', publicAnswer: 'A2' },
    ],
    publishedAt: '2026-09-01T12:00:00.000Z',
    replayReady: true,
  };
}

function contribution(input: {
  contributionId: string;
  type: KatkiType;
  body?: string | null;
  sourceNote?: string | null;
  displayName?: string;
  createdAt?: string;
}) {
  return {
    contributionId: input.contributionId,
    type: input.type,
    body: input.body === undefined ? 'Bu katkı metni yirmi karakteri aşıyor.' : input.body,
    sourceNote: input.sourceNote ?? null,
    createdAt: input.createdAt ?? '2026-10-01T09:30:00.000Z',
    contributor: {
      displayName: input.displayName ?? 'Ada',
      publicAvatarUrl: '/api/public/profile-avatars/ada.png',
      publicAvatarRevision: 2,
    },
  };
}

function readPayload(
  slug: string,
  journeyVersion: number,
  contributions: ReturnType<typeof contribution>[],
  totalVisibleCount = contributions.length,
  viewerHasActiveVerify = false,
  contentVisibleCount?: number
) {
  const countsByType = {
    verify: contributions.filter((row) => row.type === 'verify').length,
    correction: contributions.filter((row) => row.type === 'correction').length,
    additional_information: contributions.filter((row) => row.type === 'additional_information').length,
    different_perspective: contributions.filter((row) => row.type === 'different_perspective').length,
  };
  return {
    ok: true,
    data: {
      slug,
      journeyVersion,
      totalVisibleCount,
      contentVisibleCount:
        contentVisibleCount ??
        countsByType.correction +
          countsByType.additional_information +
          countsByType.different_perspective,
      countsByType,
      contributions,
      viewerHasActiveVerify,
    },
  };
}

function renderChain(ui: ReactElement, slug = 'yansi-b') {
  return render(
    <YansiExperienceSessionProvider slug={slug}>{ui}</YansiExperienceSessionProvider>
  );
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function Depth(
  props: Omit<
    ComponentProps<typeof YansiKatkiDepth>,
    'read' | 'readStatus' | 'onReadChange' | 'onClose' | 'chooseFrom'
  > &
    Partial<
      Pick<
        ComponentProps<typeof YansiKatkiDepth>,
        'read' | 'readStatus' | 'onReadChange' | 'onClose' | 'chooseFrom'
      >
    >
) {
  const read =
    props.read === undefined ? readPayload(props.slug, props.journeyVersion, []).data : props.read;
  return (
    <YansiKatkiDepth
      {...props}
      chooseFrom={props.chooseFrom ?? null}
      onClose={props.onClose ?? (() => undefined)}
      read={read}
      readStatus={props.readStatus ?? 'ready'}
      readGeneration={props.readGeneration ?? 0}
      onReadChange={props.onReadChange ?? (() => undefined)}
    />
  );
}

describe('katki depth ui', () => {
  beforeEach(() => {
    flags.desktop = true;
    flags.authenticated = true;
    requireAuth.mockReset();
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload('yansi-a', 2, []);
    });
    vi.mocked(apiClient.post).mockResolvedValue({ ok: false, error: { error_code: 'create_failed' } });
  });

  it('renders groups, a bodiless verify, source note, and public identity', async () => {
    const read = readPayload('yansi-a', 2, [
      contribution({
        contributionId: 'persp',
        type: 'different_perspective',
        displayName: 'Deniz',
        createdAt: '2026-10-04T00:00:00.000Z',
      }),
      contribution({
        contributionId: 'verify-empty',
        type: 'verify',
        body: null,
        sourceNote: null,
        displayName: 'Ada',
        createdAt: '2026-10-01T00:00:00.000Z',
      }),
      contribution({
        contributionId: 'note',
        type: 'additional_information',
        sourceNote: 'Arşiv notu',
        displayName: 'Ece',
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
    ]).data;
    render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        read={read}
        stage="list"
        selectedType={null}
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    expect(screen.queryByTestId('yansi-katki-group-verify')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-row-verify-empty')).toBeNull();
    expect(screen.getByTestId('yansi-katki-row-note')).toHaveTextContent('Ece');
    expect(screen.getByTestId('yansi-katki-row-note')).toHaveTextContent('Ek Bilgi');
    expect(screen.getByTestId('yansi-katki-row-note')).toHaveTextContent('Arşiv notu');
    expect(screen.getByText('Deniz')).toBeTruthy();
    expect(document.body.textContent).not.toContain('verify-empty');
  });

  it.each([0, 1, 24])('renders %s public verifiers with natural content and support copy', (count) => {
    const people = Array.from({ length: count }, (_, i) => ({
      displayName: `Public person ${i}`, publicHonorific: 'Meraklı',
      publicAvatarUrl: `/api/public/profile-avatars/person-${i}.png`, publicAvatarRevision: 2,
    }));
    render(<YansiVerifierPanel count={count} people={people} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Doğrulayanlar' })).toBeTruthy();
    expect(screen.queryAllByTestId('yansi-verifier-person')).toHaveLength(count);
    expect(screen.getByText(/Kesin doğruluk veya uzmanlık puanı değildir/)).toBeTruthy();
    if (count) expect(screen.getAllByText('Meraklı')).toHaveLength(count);
  });

  it('contains verifier keyboard and wheel events, traps focus, and closes outside', () => {
    const close = vi.fn();
    const keyboard = vi.fn();
    const wheel = vi.fn();
    const view = render(<div onKeyDown={keyboard} onWheel={wheel}>
      <button data-testid="outside">Outside</button>
      <YansiVerifierPanel count={0} people={[]} onClose={close} />
    </div>);
    const dialog = screen.getByRole('dialog');
    const button = screen.getByTestId('yansi-verifier-close');
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: 'Tab' });
    expect(button).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.wheel(dialog, { deltaY: 200 });
    expect(keyboard).not.toHaveBeenCalled();
    expect(wheel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('outside'));
    expect(close).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it.each([0, 1, 24])('renders %s content contributions and four filters without verify rows', (count) => {
    const rows = Array.from({ length: count }, (_, i) => contribution({
      contributionId: `content-${i}`, type: 'additional_information',
    }));
    render(<Depth slug="yansi-a" journeyVersion={2} stage="list"
      read={readPayload('yansi-a', 2, [...rows, contribution({ contributionId: 'verify', type: 'verify', body: null })]).data}
      selectedType={null} body="" sourceNote="" onBack={vi.fn()} onStartCreate={vi.fn()}
      onChooseType={vi.fn()} onChangeType={vi.fn()} onBodyChange={vi.fn()}
      onSourceChange={vi.fn()} onSubmitted={vi.fn()} />);
    expect(screen.getByRole('heading', { name: `Topluluk Katkıları ${count}` })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Katkı türleri' }).querySelectorAll('button')).toHaveLength(4);
    expect(screen.queryAllByTestId(/^yansi-katki-row-content-/)).toHaveLength(count);
    expect(screen.queryByTestId('yansi-katki-row-verify')).toBeNull();
  });

  it('keeps an empty depth quiet', async () => {
    render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="list"
        selectedType={null}
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    expect(await screen.findByTestId('yansi-katki-create')).toHaveTextContent('+ Katkı yap');
    const text = screen.getByTestId('yansi-katki-depth').textContent || '';
    for (const phrase of KATKI_EMPTY_COPY_FORBIDDEN) {
      expect(text).not.toContain(phrase);
    }
  });

  it('reads the list while logged out and asks for the existing sign-in on create', async () => {
    flags.authenticated = false;
    render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        read={
          readPayload('yansi-a', 2, [
            contribution({ contributionId: 'v1', type: 'correction', displayName: 'Ada' }),
          ]).data
        }
        stage="list"
        selectedType={null}
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
        onRequireAuth={requireAuth}
      />
    );
    expect(await screen.findByText('Ada')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('submits a text contribution and shows the new row once', async () => {
    const onSubmitted = vi.fn();
    let createdRead = readPayload('yansi-a', 2, []).data;
    const created = contribution({
      contributionId: 'created-1',
      type: 'additional_information',
      displayName: 'Ada',
    });
    vi.mocked(apiClient.post).mockResolvedValue({ ok: true, data: created });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) return readPayload('yansi-a', 2, []);
      return readPayload('yansi-a', 2, [{ ...created, contributor: { ...created.contributor, displayName: 'Server Ada' } }], 1);
    });
    const { rerender } = render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="additional_information"
        body="Bu ek bilgi yirmi karakteri asiyor."
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onReadChange={(next) => {
          createdRead = next;
        }}
        onSubmitted={onSubmitted}
      />
    );
    await screen.findByTestId('yansi-katki-composer');
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createdRead.contributions[0]?.contributor.displayName).toBe('Server Ada'));
    const postBody = vi.mocked(apiClient.post).mock.calls[0]?.[1] as { body: Record<string, unknown> };
    expect(postBody.body.type).toBe('additional_information');
    expect(postBody.body).not.toHaveProperty('userId');
    rerender(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        read={createdRead}
        stage="list"
        selectedType={null}
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={onSubmitted}
      />
    );
    const rows = await screen.findAllByTestId('yansi-katki-row-created-1');
    expect(rows).toHaveLength(1);
  });

  it('blocks a short verify body and a short required body', async () => {
    const view = render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="verify"
        body="kisa"
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    await screen.findByTestId('yansi-katki-composer');
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    expect(await screen.findByTestId('yansi-katki-body-progress')).toHaveTextContent('20');
    expect(apiClient.post).not.toHaveBeenCalled();

    view.rerender(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="correction"
        body="kisa"
        sourceNote={'n'.repeat(501)}
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    expect(await screen.findByTestId('yansi-katki-notice')).toHaveTextContent('500');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('shows Turkish duplicate and rate-limit copy without raw debug', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      error: {
        error_code: 'active_contribution_exists',
        error_message: 'duplicate key value violates constraint uq_yansi_contributions_active_type id=secret',
      },
    });
    const view = render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="verify"
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    await screen.findByTestId('yansi-katki-composer');
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    const notice = await screen.findByTestId('yansi-katki-notice');
    expect(notice).toHaveTextContent('aktif bir katkın');
    expect(notice.textContent).not.toContain('uq_yansi');
    expect(notice.textContent).not.toContain('secret');

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      error: { error_code: 'katki_create_rate_limited', error_message: '{"count":11}' },
    });
    view.rerender(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="verify"
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    expect(await screen.findByTestId('yansi-katki-notice')).toHaveTextContent('sınırına');
    expect(screen.getByTestId('yansi-katki-notice').textContent).not.toContain('count');
  });

  it('uses the existing auth path for a 401 and ignores a late response from Yansı A', async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    vi.mocked(apiClient.post).mockImplementation(
      () => new Promise((resolve) => {
        resolvePost = resolve;
      })
    );
    const onRequireAuth = vi.fn();
    const onSubmitted = vi.fn();
    const { rerender } = render(
      <Depth
        slug="yansi-a"
        journeyVersion={2}
        stage="compose"
        selectedType="verify"
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={onSubmitted}
        onRequireAuth={onRequireAuth}
      />
    );
    await screen.findByTestId('yansi-katki-composer');
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    rerender(
      <Depth
        slug="yansi-b"
        journeyVersion={3}
        stage="list"
        selectedType={null}
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={onSubmitted}
        onRequireAuth={onRequireAuth}
      />
    );
    resolvePost({
      ok: true,
      data: contribution({
        contributionId: 'from-a',
        type: 'verify',
        body: null,
        displayName: 'Ada From A',
      }),
    });
    await flushAsync();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.queryByText('Ada From A')).toBeNull();
    expect(screen.getByTestId('yansi-katki-depth')).toHaveAttribute(
      'data-yansi-katki-target',
      'yansi-b:3'
    );

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      error: { error_code: 'auth_required', error_message: '{"detail":"jwt"}' },
    });
    rerender(
      <Depth
        slug="yansi-b"
        journeyVersion={3}
        stage="compose"
        selectedType="verify"
        body=""
        sourceNote=""
        onBack={vi.fn()}
        onStartCreate={vi.fn()}
        onChooseType={vi.fn()}
        onChangeType={vi.fn()}
        onBodyChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSubmitted={onSubmitted}
        onRequireAuth={onRequireAuth}
      />
    );
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    await waitFor(() => expect(onRequireAuth).toHaveBeenCalled());
    expect(screen.queryByText(/jwt/)).toBeNull();
  });
});

describe('katki on the yansi chain', () => {
  const CLOCK_ORIGIN = 5_000;

  beforeEach(() => {
    flags.desktop = true;
    flags.authenticated = true;
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      const match = String(path).match(/\/api\/mirror-network\/([^/]+)\/contributions/);
      if (!match) return { ok: false };
      const slug = decodeURIComponent(match[1] || '');
      return readPayload(slug, 2, []);
    });
    vi.mocked(fetchDiscoverMirrors).mockReset();
    vi.mocked(fetchDiscoverMirrors).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-x',
            title: 'Canonical yansi-x',
            sceneImageUrl: 'https://cdn.example/yansi-x.jpg',
            yansiCount: 0,
          },
        ],
        total: 8,
        mode: 'random',
        randomSession: 'session-katki',
        strongCuriosityReady: false,
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function installClock() {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    });
    vi.advanceTimersByTime(CLOCK_ORIGIN);
  }

  it('opens contributions from the reel signal without leaving the reel url depth', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload(
        'yansi-b',
        2,
        [contribution({ contributionId: 'row-1', type: 'verify', body: null, displayName: 'Ada' })],
        7
      );
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    expect(screen.queryByTestId('yansi-katki-test-entry')).toBeNull();
    expect(screen.getByTestId('yansi-desktop-proof-row')).toHaveTextContent('0 katkı');
    expect(screen.getByTestId('yansi-desktop-proof-row')).toHaveTextContent('1 doğrulama');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/mirror-network/yansi-b/contributions',
      expect.objectContaining({ auth: false, params: { journeyVersion: '2' } })
    );
    fireEvent.click(screen.getByTestId('yansi-katki-reel-signal'));
    const depth = await screen.findByTestId('yansi-katki-depth');
    expect(depth).toHaveAttribute('data-yansi-katki-target', 'yansi-b:2');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute('data-yansi-public-depth', 'reel');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute('data-yansi-katki-stage', 'list');
    expect(screen.queryByTestId('mirror-frozen-replay')).toBeNull();
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(screen.getByText("Ne tür bir katkı bırakmak istersin?")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Doğrulama' })).toBeNull();
    expect(screen.queryByTestId('yansi-katki-type-verify')).toBeNull();
    for (const label of ['Düzeltme', 'Ek Bilgi', 'Farklı Bakış']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Canonical yansi-b');
    fireEvent.click(screen.getByTestId('yansi-katki-type-additional_information'));
    expect(screen.getByTestId('yansi-katki-composer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-change-type'));
    expect(screen.getByTestId('yansi-katki-type-choice')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-type-different_perspective'));
    expect(screen.getByTestId('yansi-katki-composer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-change-type'));
    fireEvent.click(screen.getByTestId('yansi-katki-back'));
    expect(screen.getByTestId('yansi-katki-list')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-close'));
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute('data-yansi-katki-stage', 'closed');
  });

  it('toggles social controls, switches panels, and preserves close and detail behavior', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload('yansi-b', 2, [
        contribution({ contributionId: 'person', type: 'verify', body: null }),
      ]);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    const contributions = screen.getByTestId('yansi-katki-reel-signal');
    const people = screen.getByTestId('yansi-katki-verifiers');
    const reads = vi.mocked(apiClient.get).mock.calls.length;
    fireEvent.click(contributions);
    expect(screen.getByTestId('yansi-katki-depth')).toBeTruthy();
    fireEvent.click(contributions);
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    fireEvent.click(people);
    expect(screen.getByTestId('yansi-verifier-panel')).toBeTruthy();
    fireEvent.click(people);
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    fireEvent.click(contributions);
    fireEvent.click(people);
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    expect(screen.getByTestId('yansi-verifier-panel')).toBeTruthy();
    fireEvent.click(contributions);
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    expect(screen.getByTestId('yansi-katki-depth')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-close'));
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    fireEvent.click(people);
    fireEvent.click(screen.getByTestId('yansi-verifier-close'));
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    fireEvent.click(people);
    fireEvent.keyDown(screen.getByTestId('mirror-yansi-chain'), { key: 'Escape' });
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    const detail = screen.getByTestId('yansi-desktop-detail-toggle');
    fireEvent.click(detail);
    expect(detail).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(detail);
    expect(detail).toHaveAttribute('aria-expanded', 'false');
    expect(apiClient.get).toHaveBeenCalledTimes(reads);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each(['contributions', 'verifiers'])('closes active %s on Reel navigation', async (panel) => {
    installClock();
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload('yansi-b', 2, [
        contribution({ contributionId: 'person', type: 'verify', body: null }),
      ]);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    fireEvent.click(screen.getByTestId(
      panel === 'contributions' ? 'yansi-katki-reel-signal' : 'yansi-katki-verifiers'
    ));
    expect(screen.getByTestId(
      panel === 'contributions' ? 'yansi-katki-depth' : 'yansi-verifier-panel'
    )).toBeTruthy();
    fireEvent.click(screen.getByTestId('mirror-skip-to-next'));
    await flushAsync();
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(YANSI_REEL_TRAVEL_MS);
    });
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute('data-active-slug', 'yansi-x');
  });

  it('does not let conversation and contributions coexist', async () => {
    const onDepthChange = vi.fn();
    renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b')}
        depth="reel"
        onDepthChange={onDepthChange}
      />
    );
    await flushAsync();
    fireEvent.click(await screen.findByRole('button', { name: '0 katkı' }));
    expect(screen.getByTestId('yansi-katki-depth')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mirror-yansi-active-title'));
    expect(onDepthChange).toHaveBeenCalledWith('chat');
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
  });

  it('lets reel wheel travel and blocks wheel inside Katkılar and the composer', async () => {
    installClock();
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    const chain = screen.getByTestId('mirror-yansi-chain');
    fireEvent.click(screen.getByRole('button', { name: '0 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(screen.getByTestId('yansi-katki-depth')).toBeTruthy();
    fireEvent.wheel(screen.getByTestId('yansi-katki-lane'), {
      deltaY: YANSI_WHEEL_COMMIT_PX,
      bubbles: true,
      cancelable: true,
    });
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-b');
    expect(fetchDiscoverMirrors).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('yansi-katki-type-correction'));
    fireEvent.wheel(screen.getByTestId('yansi-katki-body'), {
      deltaY: YANSI_WHEEL_COMMIT_PX,
      bubbles: true,
      cancelable: true,
    });
    await flushAsync();
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    expect(fetchDiscoverMirrors).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByTestId('yansi-katki-body'), { key: 'Escape' });
    fireEvent.keyDown(chain, { key: 'Escape' });
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'down');
    expect(chain).toHaveAttribute('data-yansi-incoming-slug', 'yansi-x');
  });

  it('keeps conversation wheel behavior', async () => {
    installClock();
    renderChain(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="chat" />
    );
    await flushAsync();
    const chain = screen.getByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-yansi-public-depth', 'chat');
    expect(screen.queryByTestId('yansi-katki-test-entry')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-reel-signal')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    expect(chain).toHaveAttribute('data-yansi-reel-transition', 'idle');
    expect(fetchDiscoverMirrors).not.toHaveBeenCalled();
    expect(screen.getByTestId('yansi-chat-composer-lane')).toBeTruthy();
  });

  it('drops a late Yansı A read after travel to Yansı B', async () => {
    installClock();
    let resolveA: (value: unknown) => void = () => undefined;
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (!String(path).includes('/contributions')) return Promise.resolve({ ok: false });
      if (String(path).includes('yansi-b')) {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve(
        readPayload(
          'yansi-x',
          2,
          [contribution({ contributionId: 'b-row', type: 'verify', body: null, displayName: 'Bora' })],
          2
        )
      );
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    expect(screen.queryByRole('button', { name: 'Katkı yap' })).toBeNull();
    expect(screen.queryByText('9 katkı')).toBeNull();
    const chain = screen.getByTestId('mirror-yansi-chain');
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(YANSI_REEL_TRAVEL_MS);
    });
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    resolveA(readPayload('yansi-b', 2, [], 9));
    await flushAsync();
    expect(screen.queryByText('9 katkı')).toBeNull();
    expect(screen.queryByText('Ada From A')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '0 katkı' }));
    expect(screen.getByTestId('yansi-katki-depth')).toHaveAttribute(
      'data-yansi-katki-target',
      'yansi-x:2'
    );
    expect(screen.queryByText('Bora')).toBeNull();
    fireEvent.click(screen.getByTestId('yansi-katki-verifiers'));
    expect(screen.getByTestId('yansi-verifier-panel')).toHaveTextContent('Bora');
    expect(screen.queryByText('Ada From A')).toBeNull();
  });

  it('resets a draft when reel travel changes the Yansı', async () => {
    installClock();
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    fireEvent.click(screen.getByRole('button', { name: '0 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(screen.getByTestId('yansi-katki-type-choice')).toBeTruthy();
    fireEvent.click(screen.getByTestId('yansi-katki-type-correction'));
    fireEvent.change(screen.getByTestId('yansi-katki-body'), {
      target: { value: 'taslak yansi a metni yeterince uzun' },
    });
    fireEvent.keyDown(screen.getByTestId('yansi-katki-body'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByTestId('mirror-yansi-chain'), { key: 'Escape' });
    const chain = screen.getByTestId('mirror-yansi-chain');
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(YANSI_REEL_TRAVEL_MS);
    });
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    expect(chain).toHaveAttribute('data-yansi-katki-stage', 'closed');
    fireEvent.click(screen.getByRole('button', { name: '0 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    fireEvent.click(screen.getByTestId('yansi-katki-type-correction'));
    expect(screen.getByTestId('yansi-katki-body')).toHaveValue('');
    expect(screen.getByTestId('yansi-katki-depth')).toHaveAttribute(
      'data-yansi-katki-target',
      'yansi-x:2'
    );
  });

  it('does not claim zero while the contribution read is pending', async () => {
    let resolveRead: (value: unknown) => void = () => undefined;
    vi.mocked(apiClient.get).mockImplementation(
      (path: string) =>
        new Promise((resolve) => {
          if (String(path).includes('/contributions')) resolveRead = resolve;
          else resolve({ ok: false });
        })
    );
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    expect(screen.getByTestId('yansi-desktop-detail-toggle')).toHaveTextContent('Detay');
    expect(screen.queryByRole('button', { name: 'Katkı yap' })).toBeNull();
    expect(screen.queryByText('0 katkı')).toBeNull();
    resolveRead(readPayload('yansi-b', 2, []));
    expect(await screen.findByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 doğrulama' })).toBeTruthy();
  });

  it('stays quiet on the reel when the contribution read fails', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return {
        ok: false,
        error: { error_code: 'frozen_journey_not_found', error_message: 'SQL constraint secret' },
      };
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    expect(screen.getByTestId('yansi-desktop-detail-toggle')).toHaveTextContent('Detay');
    expect(screen.queryByRole('button', { name: 'Katkı yap' })).toBeNull();
    expect(screen.queryByText('0 katkı')).toBeNull();
    expect(screen.getByTestId('yansi-desktop-proof-row').textContent).not.toContain('SQL');
    expect(screen.getByTestId('yansi-desktop-proof-row').textContent).not.toContain('secret');
  });

  it('opens type choice from Katkı yap and ignores another version', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return {
        ok: true,
        data: { ...readPayload('yansi-b', 9, [], 4).data, journeyVersion: 9 },
      };
    });
    const wrong = renderChain(
      <MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />
    );
    await flushAsync();
    expect(screen.queryByText('4 katkı')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Katkı yap' })).toBeNull();
    wrong.unmount();

    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload('yansi-b', 2, []);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByRole('button', { name: '0 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(screen.getByTestId('yansi-katki-type-choice')).toBeTruthy();
    expect(screen.getByText('Ne tür bir katkı bırakmak istersin?')).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.queryByText('Henüz katkı yok')).toBeNull();
    expect(screen.queryByText('İlk katkıyı sen yap')).toBeNull();
  });

  it('shows 1 doğrulama after a server verify toggle', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-b',
        journeyVersion: 2,
        viewerHasActiveVerify: true,
        totalVisibleCount: 1,
        contentVisibleCount: 0,
        countsByType: {
          verify: 1,
          correction: 0,
          additional_information: 0,
          different_perspective: 0,
        },
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) return readPayload('yansi-b', 2, []);
      return readPayload(
        'yansi-b',
        2,
        [contribution({ contributionId: 'created-reel', type: 'verify', body: null, displayName: 'Ada' })],
        1,
        true
      );
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByTestId('yansi-katki-verify'));
    expect(screen.queryByTestId('yansi-katki-composer')).toBeNull();
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/mirror-network/yansi-b/contributions/verify-toggle',
      expect.objectContaining({
        body: { journeyVersion: 2 },
      })
    );
    expect(await screen.findByRole('button', { name: '1 doğrulama' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.getByTestId('yansi-katki-verify')).toHaveAttribute('data-yansi-verify', 'active');
    expect(screen.queryByTestId('yansi-verifier-panel')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-reel-create')).toBeNull();
  });

  it('replaces the optimistic total with the reconciled server total', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: contribution({
        contributionId: 'created-9',
        type: 'correction',
        displayName: 'Ada',
      }),
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) {
        return readPayload('yansi-b', 2, [], 7, false, 7);
      }
      return readPayload('yansi-b', 2, [], 9, false, 9);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByRole('button', { name: '7 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    fireEvent.click(screen.getByTestId('yansi-katki-type-correction'));
    fireEvent.change(screen.getByTestId('yansi-katki-body'), {
      target: { value: 'sunucu ile uzlasan duzeltme metni' },
    });
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    expect(await screen.findByTestId('yansi-katki-list')).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId('mirror-yansi-chain'), { key: 'Escape' });
    expect(await screen.findByRole('button', { name: '9 katkı' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '8 katkı' })).toBeNull();
  });

  it('accepts a lower reconciled total after moderation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: contribution({
        contributionId: 'created-6',
        type: 'correction',
        displayName: 'Ada',
      }),
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) {
        return readPayload('yansi-b', 2, [], 7, false, 7);
      }
      return readPayload('yansi-b', 2, [], 6, false, 6);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByRole('button', { name: '7 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    fireEvent.click(screen.getByTestId('yansi-katki-type-correction'));
    fireEvent.change(screen.getByTestId('yansi-katki-body'), {
      target: { value: 'moderasyon sonrasi dusen toplam metni' },
    });
    fireEvent.click(screen.getByTestId('yansi-katki-submit'));
    fireEvent.keyDown(await screen.findByTestId('mirror-yansi-chain'), { key: 'Escape' });
    expect(await screen.findByRole('button', { name: '6 katkı' })).toBeTruthy();
  });

  it('keeps the created row when reconciliation fails', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: contribution({
        contributionId: 'created-keep',
        type: 'verify',
        body: null,
        displayName: 'Ada',
      }),
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) return readPayload('yansi-b', 2, []);
      return { ok: false, error: { error_code: 'frozen_journey_not_found', error_message: 'SQL secret' } };
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByTestId('yansi-katki-verify'));
    expect(screen.queryByText(/SQL/)).toBeNull();
    expect(await screen.findByRole('button', { name: '1 doğrulama' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.queryByTestId('yansi-katki-notice')).toBeNull();
  });

  it('drops a late reconciliation for Yansı A after travel to B', async () => {
    installClock();
    let resolveA: (value: unknown) => void = () => undefined;
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: contribution({
        contributionId: 'created-a',
        type: 'verify',
        body: null,
        displayName: 'Ada',
      }),
    });
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (!String(path).includes('/contributions')) return Promise.resolve({ ok: false });
      const slug = String(path).includes('yansi-x') ? 'yansi-x' : 'yansi-b';
      if (slug === 'yansi-b' && vi.mocked(apiClient.post).mock.calls.length > 0) {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      if (slug === 'yansi-x') {
        return Promise.resolve(readPayload('yansi-x', 2, [], 2));
      }
      return Promise.resolve(readPayload('yansi-b', 2, []));
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    fireEvent.click(screen.getByTestId('yansi-katki-verify'));
    await flushAsync();
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    const chain = screen.getByTestId('mirror-yansi-chain');
    fireEvent.wheel(chain, { deltaY: YANSI_WHEEL_COMMIT_PX, bubbles: true, cancelable: true });
    await flushAsync();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(YANSI_REEL_TRAVEL_MS);
    });
    expect(chain).toHaveAttribute('data-active-slug', 'yansi-x');
    resolveA(readPayload('yansi-b', 2, [], 99));
    await flushAsync();
    expect(screen.queryByRole('button', { name: '99 katkı' })).toBeNull();
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 doğrulama' })).toBeTruthy();
  });

  it('ignores a reconciled payload for another journey version', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: contribution({
        contributionId: 'created-version',
        type: 'verify',
        body: null,
        displayName: 'Ada',
      }),
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) return readPayload('yansi-b', 2, []);
      return readPayload('yansi-b', 9, [], 4);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByTestId('yansi-katki-verify'));
    expect(screen.queryByTestId('yansi-katki-composer')).toBeNull();
    expect(await screen.findByRole('button', { name: '1 doğrulama' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '4 katkı' })).toBeNull();
  });

  it('does not activate Doğrula from another viewer verify count', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      return readPayload(
        'yansi-b',
        2,
        [contribution({ contributionId: 'other', type: 'verify', body: null, displayName: 'Ece' })],
        4,
        false
      );
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const verify = await screen.findByTestId('yansi-katki-verify');
    expect(verify).toHaveAttribute('data-yansi-verify', 'idle');
    expect(verify).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '0 katkı' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 doğrulama' })).toBeTruthy();
  });

  it('toggles off an active verify through the server', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-b',
        journeyVersion: 2,
        viewerHasActiveVerify: false,
        totalVisibleCount: 0,
        contentVisibleCount: 0,
        countsByType: {
          verify: 0,
          correction: 0,
          additional_information: 0,
          different_perspective: 0,
        },
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) {
        return readPayload('yansi-b', 2, [], 0, true);
      }
      return readPayload('yansi-b', 2, []);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const verify = await screen.findByTestId('yansi-katki-verify');
    expect(verify).toHaveAttribute('data-yansi-verify', 'active');
    fireEvent.click(verify);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('yansi-katki-composer')).toBeNull();
    expect(await screen.findByTestId('yansi-katki-verify')).toHaveAttribute('data-yansi-verify', 'idle');
  });

  it('blocks a second verify click while the first post is in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    vi.mocked(apiClient.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    const verify = await screen.findByTestId('yansi-katki-verify');
    fireEvent.click(verify);
    fireEvent.click(verify);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    release({
      ok: true,
      data: contribution({ contributionId: 'once', type: 'verify', body: null, displayName: 'Ada' }),
    });
    await flushAsync();
  });

  it('reconciles a duplicate verify instead of showing the raw conflict', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      error: { error_code: 'active_contribution_exists', error_message: 'duplicate row secret' },
    });
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (!String(path).includes('/contributions')) return { ok: false };
      if (vi.mocked(apiClient.post).mock.calls.length === 0) return readPayload('yansi-b', 2, []);
      return readPayload('yansi-b', 2, [], 1, true);
    });
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByTestId('yansi-katki-verify'));
    expect(await screen.findByTestId('yansi-katki-verify')).toHaveAttribute('data-yansi-verify', 'active');
    expect(screen.queryByText(/duplicate/)).toBeNull();
    expect(screen.queryByText(/secret/)).toBeNull();
    expect(screen.queryByTestId('yansi-katki-notice')).toBeNull();
  });

  it('asks for auth before a logged-out verify and does not post', async () => {
    flags.authenticated = false;
    renderChain(
      <MirrorYansiChainExperience
        rootArtifact={makeArtifact('yansi-b')}
        depth="reel"
        onRequireAuth={requireAuth}
      />
    );
    fireEvent.click(await screen.findByTestId('yansi-katki-verify'));
    expect(requireAuth).toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
  });

  it('requires a body for each text contribution and keeps the reel mounted', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    fireEvent.click(await screen.findByRole('button', { name: '0 katkı' }));
    fireEvent.click(screen.getByTestId('yansi-katki-create'));
    expect(screen.getByTestId('mirror-yansi-active-title')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Doğrulama' })).toBeNull();
    for (const type of ['correction', 'additional_information', 'different_perspective'] as const) {
      fireEvent.click(screen.getByTestId(`yansi-katki-type-${type}`));
      fireEvent.click(screen.getByTestId('yansi-katki-submit'));
      expect(await screen.findByTestId('yansi-katki-body-progress')).toHaveTextContent('20');
      fireEvent.click(screen.getByTestId('yansi-katki-change-type'));
    }
    fireEvent.click(screen.getByTestId('yansi-katki-close'));
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Canonical yansi-b');
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe('katki mobile freeze and reel contract', () => {
  beforeEach(() => {
    flags.desktop = false;
    flags.authenticated = false;
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockResolvedValue({ ok: false });
  });

  it('does not mount Katkılar on the mobile reel', async () => {
    renderChain(<MirrorYansiChainExperience rootArtifact={makeArtifact('yansi-b')} depth="reel" />);
    await flushAsync();
    const chain = screen.getByTestId('mirror-yansi-chain');
    expect(chain).toHaveAttribute('data-mobile-yansi', 'true');
    expect(chain).toHaveAttribute('data-yansi-katki-stage', 'closed');
    expect(screen.queryByTestId('yansi-katki-test-entry')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-reel-signal')).toBeNull();
    expect(screen.queryByTestId('yansi-katki-verify')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Doğrula' })).toBeNull();
    expect(screen.queryByText('Katkı yap')).toBeNull();
    expect(
      vi.mocked(apiClient.get).mock.calls.every(
        (call) => !String(call[0]).includes('/contributions')
      )
    ).toBe(true);
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
    expect(screen.getByTestId('yansi-mobile-public-header')).toBeTruthy();
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Canonical yansi-b');
    fireEvent.click(screen.getByTestId('mirror-yansi-active-title'));
    expect(screen.queryByTestId('yansi-katki-depth')).toBeNull();
  });

  it('leaves the production metrics row and mobile css freeze untouched', () => {
    const surface = readFileSync(
      join(process.cwd(), 'components/mirror-landing/YansiDesktopReelSurface.tsx'),
      'utf8'
    );
    const metrics = readFileSync(
      join(process.cwd(), 'components/mirror-landing/YansiPublicMetricsLine.tsx'),
      'utf8'
    );
    const css = readFileSync(join(process.cwd(), 'styles/yansi-reel-responsive.css'), 'utf8');
    expect(surface).toContain('yansi-katki-reel-signal');
    expect(surface).toContain('formatVerifyReelCount');
    expect(surface).not.toContain('Katkı yap');
    const discover = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(discover).not.toContain('contributions');
    expect(discover).not.toContain('Doğrula');
    expect(discover).not.toContain('Katkı yap');
    expect(metrics).not.toMatch(/katkı/i);
    expect(metrics).not.toContain('contributions');
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(mobileBlock).toContain('.yansi-katki-depth');
    expect(mobileBlock).toContain('.yansi-katki-reel-signal');
    expect(mobileBlock).not.toContain('yansi-katki-test-entry');
    expect(mobileBlock).toContain('display: none !important');
    expect(css).toContain('--bilign-yansi-reel-title-size: 35px');
  });
});
