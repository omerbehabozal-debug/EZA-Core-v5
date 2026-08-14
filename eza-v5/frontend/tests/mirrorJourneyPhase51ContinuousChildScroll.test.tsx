/**
 * Phase 5.1 — continuous published-child scroll + own continuation CTA.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer')
  >('@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer');
  return {
    ...actual,
    fetchPublicFrozenJourneyArtifact: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchPublishedChildren: vi.fn(),
    fetchAuthorPublishedYansilar: vi.fn(),
  };
});

import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import {
  fetchPublishedChildren,
  fetchAuthorPublishedYansilar,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  clearAllFrozenReplayProgressForTests,
  loadFrozenReplayProgress,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  loadChildContinuationPlan,
  selectPrimaryAndAlternatives,
} from '@/lib/eza/mirror/journey/yansiChildContinuation';
import { clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import {
  clearEzaUserPreferencesForTests,
  setEzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';

function makeArtifact(
  slug: string,
  overrides?: Partial<PublicFrozenJourneyArtifact> & { stepCount?: 6 | 7 | 8 }
) {
  const n = overrides?.stepCount ?? 6;
  const steps = Array.from({ length: n }, (_, i) => ({
    stepIndex: i + 1,
    publicQuestion: `${slug} Soru ${i + 1}?`,
    publicAnswer: `${slug} Cevap ${i + 1}.`,
    ezaSnapshot: { assistantScore: 80 + i, userScore: 70 + i, ezaFinal: 80 + i },
  }));
  return parsePublicFrozenJourneyArtifact({
    slug,
    journeyId: slug,
    journeyVersion: 1,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    authorUserId: `author-${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    selectedCount: n,
    steps,
    replayReady: true,
    ...overrides,
  })!;
}

function childMeta(slug: string, parentSlug: string) {
  return {
    slug,
    shareUrl: `/m/${slug}`,
    publicTitle: `Title ${slug}`,
    publicSummary: `Summary ${slug}`,
    sceneImageUrl: `https://cdn.example/${slug}.jpg`,
    publishedAt: '2026-08-01T00:00:00Z',
    parentSlug,
  };
}

beforeEach(() => {
  clearAllFrozenReplayProgressForTests();
  clearEzaUserPreferencesForTests();
  clearPublicAuthorDisplayCacheForTests();
  localStorage.clear();
  vi.mocked(fetchPublicFrozenJourneyArtifact).mockReset();
  vi.mocked(fetchPublishedChildren).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockReset();
  vi.mocked(fetchAuthorPublishedYansilar).mockImplementation(async (userId) => ({
    ok: true,
    data: {
      userId,
      displayName: userId.replace('author-', 'Name '),
      items: [],
      total: 0,
    },
  }));
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Phase 5.1 child plan (deterministic primary)', () => {
  it('M/N. first eligible child is primary; rest are alternatives', async () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a', authorUserId: 'author-b' });
    const c = makeArtifact('yansi-c', { parentSlug: 'yansi-a', authorUserId: 'author-c' });
    const d = makeArtifact('yansi-d', { parentSlug: 'yansi-a', authorUserId: 'author-d' });

    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        parentTitle: a.publicTitle,
        items: [childMeta('yansi-b', 'yansi-a'), childMeta('yansi-c', 'yansi-a'), childMeta('yansi-d', 'yansi-a')],
        total: 3,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-b') return b;
      if (slug === 'yansi-c') return c;
      if (slug === 'yansi-d') return d;
      return null;
    });

    const plan = await loadChildContinuationPlan('yansi-a');
    expect(plan.primary?.artifact.slug).toBe('yansi-b');
    expect(plan.alternatives.map((x) => x.artifact.slug)).toEqual(['yansi-c', 'yansi-d']);
    expect(plan.alternatives).toHaveLength(2);

    const picked = selectPrimaryAndAlternatives([
      { meta: childMeta('yansi-b', 'yansi-a'), artifact: b },
      { meta: childMeta('yansi-c', 'yansi-a'), artifact: c },
      { meta: childMeta('yansi-d', 'yansi-a'), artifact: d },
    ]);
    expect(picked.primary?.artifact.slug).toBe('yansi-b');
    expect(picked.alternatives).toHaveLength(2);
  });

  it('skips non-replay-ready / missing frozen children', async () => {
    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        items: [childMeta('broken', 'yansi-a'), childMeta('yansi-b', 'yansi-a')],
        total: 2,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'broken') return null;
      if (slug === 'yansi-b') return makeArtifact('yansi-b', { parentSlug: 'yansi-a' });
      return null;
    });
    const plan = await loadChildContinuationPlan('yansi-a');
    expect(plan.primary?.artifact.slug).toBe('yansi-b');
    expect(plan.skippedCount).toBe(1);
  });

  it('child query failure yields empty plan (own CTA still independent)', async () => {
    vi.mocked(fetchPublishedChildren).mockResolvedValue({ ok: false });
    const plan = await loadChildContinuationPlan('yansi-a');
    expect(plan.primary).toBeNull();
    expect(plan.alternatives).toEqual([]);
  });
});

describe('Phase 5.1 own continuation routing', () => {
  it('Q. CTA on A routes to /m/A/sohbet', async () => {
    const a = makeArtifact('yansi-a');
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );
    render(<MirrorFrozenReplay artifact={a} />);
    const link = await screen.findByTestId('mirror-frozen-replay-continue');
    expect(link).toHaveAttribute('href', '/m/yansi-a/sohbet');
    expect(link).toHaveTextContent('Kendi merakımla devam et');
  });

  it('R. CTA on B routes to /m/B/sohbet', async () => {
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a' });
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-b:v1`,
      JSON.stringify({
        slug: 'yansi-b',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );
    render(<MirrorFrozenReplay artifact={b} />);
    const link = await screen.findByTestId('mirror-frozen-replay-continue');
    expect(link).toHaveAttribute('href', '/m/yansi-b/sohbet');
  });
});

describe('Phase 5.1 replay isolation', () => {
  it('J/K. A completed progress does not mark B complete', () => {
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );
    expect(loadFrozenReplayProgress('yansi-a', 1)?.replayCompleted).toBe(true);
    expect(loadFrozenReplayProgress('yansi-b', 1)).toBeNull();
  });
});

describe('Phase 5.1 continuous chain UI', () => {
  it('G/H/I + 5.1.1: complete A prepares B without auto-scroll/activation', async () => {
    const a = makeArtifact('yansi-a', {
      authorUserId: 'author-a',
      sceneImageUrl: 'https://cdn.example/yansi-a.jpg',
    });
    const b = makeArtifact('yansi-b', {
      parentSlug: 'yansi-a',
      authorUserId: 'author-b',
      publicTitle: 'Title yansi-b',
      sceneImageUrl: 'https://cdn.example/yansi-b.jpg',
    });

    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        items: [childMeta('yansi-b', 'yansi-a')],
        total: 1,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-a') return a;
      if (slug === 'yansi-b') return b;
      return null;
    });

    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    render(<MirrorYansiChainExperience rootArtifact={a} />);

    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-b')).toBeTruthy();
    });

    // Preload only — no automatic viewport move
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('mirror-yansi-chain')).toHaveAttribute(
      'data-active-slug',
      'yansi-a'
    );

    const sectionA = screen.getByTestId('mirror-yansi-section-yansi-a');
    expect(within(sectionA).getByTestId('mirror-frozen-replay-continue')).toHaveAttribute(
      'href',
      '/m/yansi-a/sohbet'
    );
    expect(within(sectionA).getByText('Bu Yansı burada tamamlandı.')).toBeTruthy();
    expect(screen.getByTestId('mirror-continuation-cue')).toHaveTextContent(
      '1 Yansı buradan devam etti'
    );

    // Scene identity remains A while A is active
    expect(screen.getByTestId('mirror-yansi-scene-current')).toHaveAttribute(
      'src',
      'https://cdn.example/yansi-a.jpg'
    );

    const sectionB = screen.getByTestId('mirror-yansi-section-yansi-b');
    expect(within(sectionB).getByText('Title yansi-b')).toBeTruthy();
    expect(within(sectionB).getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-b Soru 1?'
    );
    // B not started
    expect(loadFrozenReplayProgress('yansi-b', 1)).toBeNull();

    expect(vi.mocked(fetchPublishedChildren)).toHaveBeenCalledWith('yansi-a');
  });

  it('M/O. Diğer yollar opens alternate and selecting C loads C artifact', async () => {
    const a = makeArtifact('yansi-a');
    const b = makeArtifact('yansi-b', { parentSlug: 'yansi-a', authorUserId: 'author-b' });
    const c = makeArtifact('yansi-c', { parentSlug: 'yansi-a', authorUserId: 'author-c' });

    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: {
        parentSlug: 'yansi-a',
        items: [childMeta('yansi-b', 'yansi-a'), childMeta('yansi-c', 'yansi-a')],
        total: 2,
      },
    });
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockImplementation(async ({ slug }) => {
      if (slug === 'yansi-b') return b;
      if (slug === 'yansi-c') return c;
      if (slug === 'yansi-a') return a;
      return null;
    });

    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );

    render(<MirrorYansiChainExperience rootArtifact={a} />);

    await waitFor(() => {
      expect(screen.getByTestId('mirror-other-paths')).toHaveTextContent('Diğer 1 yol');
    });

    fireEvent.click(screen.getByTestId('mirror-other-paths'));
    expect(screen.getByTestId('mirror-alternate-children-sheet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mirror-alternate-child-yansi-c'));

    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-section-yansi-c')).toBeTruthy();
    });
    const sectionC = screen.getByTestId('mirror-yansi-section-yansi-c');
    expect(within(sectionC).getByText('Title yansi-c')).toBeTruthy();
    expect(within(sectionC).getByTestId('mirror-frozen-replay-next-question')).toHaveTextContent(
      'yansi-c Soru 1?'
    );
    // B still present and unmixed
    expect(
      within(screen.getByTestId('mirror-yansi-section-yansi-b')).getByTestId(
        'mirror-frozen-replay-next-question'
      )
    ).toHaveTextContent('yansi-b Soru 1?');
  });

  it('10. no children → no fake continuation section', async () => {
    const a = makeArtifact('yansi-a');
    vi.mocked(fetchPublishedChildren).mockResolvedValue({
      ok: true,
      data: { parentSlug: 'yansi-a', items: [], total: 0 },
    });
    localStorage.setItem(
      `eza_frozen_replay_progress_v1:yansi-a:v1`,
      JSON.stringify({
        slug: 'yansi-a',
        journeyVersion: 1,
        completedStepCount: 6,
        replayCompleted: true,
      })
    );
    render(<MirrorYansiChainExperience rootArtifact={a} />);
    await waitFor(() => {
      expect(screen.getByTestId('mirror-frozen-replay-continue')).toBeTruthy();
    });
    expect(screen.queryByTestId('mirror-other-paths')).toBeNull();
    expect(screen.queryByText(/0 Yansı/i)).toBeNull();
  });

  it('landing wires chain after start (stored identity, no AI)', async () => {
    const a = makeArtifact('demo-yansi');
    vi.mocked(fetchPublicFrozenJourneyArtifact).mockResolvedValue(a);
    render(
      <MirrorLandingExperience
        surface={{
          slug: 'demo-yansi',
          cardTitle: 'Demo',
          cardDate: '2026-08-12',
          dayLabel: '12 Ağustos',
          sceneImageUrl: null,
          curiosityContext: 'Özet',
        }}
      />
    );
    fireEvent.click(await screen.findByTestId('mirror-experience-start'));
    await waitFor(() => {
      expect(screen.getByTestId('mirror-yansi-chain')).toBeTruthy();
    });
    expect(screen.getByText('Title demo-yansi')).toBeTruthy();
  });
});

describe('Phase 5.1 EZA isolation', () => {
  it('T/U/V. frozen EZA stays per artifact; visibility hides both', async () => {
    const a = makeArtifact('yansi-a');
    setEzaUserPreferences(null, { ezaVisibilityEnabled: false });
    render(<MirrorFrozenReplay artifact={a} />);
    fireEvent.click(await screen.findByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => {
      expect(screen.getByText('yansi-a Cevap 1.')).toBeTruthy();
    });
    // Scores should not render when visibility off (ChatBubble hides them)
    expect(document.body.textContent).not.toMatch(/80/);
  });
});
