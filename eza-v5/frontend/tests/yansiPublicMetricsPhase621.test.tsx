/**
 * Phase 6.2.1 — Discover/Profile consume projected canonical metrics.
 * No per-card GET /metrics.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import AuthorPublishedYansiProfile from '@/components/mirror/ayna/AuthorPublishedYansiProfile';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import { formatDiscoverYansiCount } from '@/lib/eza/mirror-network/discoverCopy';
import { formatYansiPublicSocialProof } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { fetchYansiPublicMetrics } from '@/lib/eza/mirror-network/yansiPublicMetrics';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/eza/mirror-network/startDiscoverGuestChat', () => ({
  startDiscoverGuestChatFromSlug: vi.fn(),
}));

vi.mock('@/lib/eza/mirror-network/yansiPublicMetrics', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/yansiPublicMetrics')
  >('@/lib/eza/mirror-network/yansiPublicMetrics');
  return {
    ...actual,
    fetchYansiPublicMetrics: vi.fn(),
  };
});

vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/eza/mirror-network/fetchAuthorPublished')
  >('@/lib/eza/mirror-network/fetchAuthorPublished');
  return {
    ...actual,
    fetchAuthorPublishedYansilar: vi.fn(),
  };
});

import { fetchAuthorPublishedYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';

const canonicalItem = (
  slug: string,
  started: number,
  children: number,
  extras?: Partial<DiscoverMirror>
): DiscoverMirror => ({
  slug,
  title: `Title ${slug}`,
  sceneImageUrl: `https://cdn.example/${slug}.png`,
  yansiCount: extras?.yansiCount ?? 99,
  journeyVersion: extras?.journeyVersion ?? 1,
  experienceStartedCount: started,
  directChildYansiCount: children,
  ...extras,
});

describe('Phase 6.2.1 Discover projection UI', () => {
  beforeEach(() => {
    vi.mocked(fetchYansiPublicMetrics).mockReset();
  });

  it('shows 140 deneyim · 7 Yansı from projected fields, never legacy 9999/99', () => {
    render(
      <SainaDiscoverCard
        item={canonicalItem('yansi-a', 140, 7, { yansiCount: 99 })}
      />
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '140 deneyim · 7 Yansı'
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveAttribute(
      'aria-label',
      '140 deneyim, 7 Yansı'
    );
    expect(screen.queryByText('9999 deneyim')).toBeNull();
    expect(screen.queryByText(formatDiscoverYansiCount(99))).toBeNull();
    expect(fetchYansiPublicMetrics).not.toHaveBeenCalled();
  });

  it('applies Phase 6.2 zero rules', () => {
    const { unmount } = render(
      <SainaDiscoverCard item={canonicalItem('z0', 0, 0)} />
    );
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    unmount();

    render(<SainaDiscoverCard item={canonicalItem('z1', 140, 0)} />);
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent('140 deneyim');
    expect(screen.getByTestId('yansi-public-metrics').textContent).not.toContain('Yansı');
  });

  it('shows 0 deneyim · 3 Yansı and 1 deneyim · 1 Yansı', () => {
    const { unmount } = render(
      <SainaDiscoverCard item={canonicalItem('z2', 0, 3)} />
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '0 deneyim · 3 Yansı'
    );
    unmount();
    render(<SainaDiscoverCard item={canonicalItem('z3', 1, 1)} />);
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '1 deneyim · 1 Yansı'
    );
  });

  it('version pin: v1 card shows 140 not v2 20', () => {
    render(
      <SainaDiscoverCard
        item={canonicalItem('yansi-a', 140, 7, { journeyVersion: 1 })}
      />
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveAttribute(
      'data-metrics-version',
      '1'
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent('140 deneyim');
  });

  it('hides row when canonical fields are missing — no legacy fallback', () => {
    render(
      <SainaDiscoverCard
        item={{
          slug: 'legacy-only',
          title: 'Legacy',
          sceneImageUrl: 'https://cdn.example/a.png',
          yansiCount: 99,
        }}
      />
    );
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
    expect(screen.queryByText(formatDiscoverYansiCount(99))).toBeNull();
    expect(fetchYansiPublicMetrics).not.toHaveBeenCalled();
  });

  it('feed of many cards does not call /metrics', () => {
    render(
      <>
        <SainaDiscoverCard item={canonicalItem('a', 10, 1)} />
        <SainaDiscoverCard item={canonicalItem('b', 20, 2)} />
        <SainaDiscoverCard item={canonicalItem('c', 30, 3)} />
      </>
    );
    expect(screen.getAllByTestId('yansi-public-metrics')).toHaveLength(3);
    expect(fetchYansiPublicMetrics).not.toHaveBeenCalled();
  });
});

describe('Phase 6.2.1 Profile projection UI', () => {
  beforeEach(() => {
    vi.mocked(fetchAuthorPublishedYansilar).mockReset();
    vi.mocked(fetchYansiPublicMetrics).mockReset();
  });

  it('shows 140 deneyim not legacy experienceCount 42', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'author-1',
        displayName: 'Ada',
        total: 1,
        items: [
          {
            slug: 'yansi-a',
            shareUrl: '/m/yansi-a',
            publicTitle: 'Title yansi-a',
            publicSummary: 'Summary',
            sceneImageUrl: null,
            journeyVersion: 1,
            experienceStartedCount: 140,
            directChildYansiCount: 0,
          },
        ],
      },
    });
    render(<AuthorPublishedYansiProfile userId="author-1" />);
    expect(await screen.findByTestId('yansi-public-metrics')).toHaveTextContent(
      '140 deneyim'
    );
    expect(screen.queryByText('42 deneyim')).toBeNull();
    expect(fetchYansiPublicMetrics).not.toHaveBeenCalled();
  });

  it('hides metrics when projection omitted', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValue({
      ok: true,
      data: {
        userId: 'author-1',
        displayName: 'Ada',
        total: 1,
        items: [
          {
            slug: 'yansi-a',
            shareUrl: '/m/yansi-a',
            publicTitle: 'Title yansi-a',
          },
        ],
      },
    });
    render(<AuthorPublishedYansiProfile userId="author-1" />);
    expect(await screen.findByTestId('author-published-item')).toBeTruthy();
    expect(screen.queryByTestId('yansi-public-metrics')).toBeNull();
  });
});

describe('Phase 6.2.1 Ayna / cross-surface', () => {
  it('Ayna slide uses canonical fields and ignores continuationStarts placeholder', () => {
    render(
      <AynaJourneySlide
        artifact={{
          journeyId: 'j1',
          journeyVersion: 1,
          sourceConversationId: 'c',
          blockIndex: 0,
          generationId: 'g',
          selectedCount: 8,
          selectedStepsHash: 'h',
          status: 'published',
          publish: { slug: 'yansi-a' },
          publicTitle: 'A',
          createdAt: 't',
          updatedAt: 't',
          stateVersion: 1,
          experienceCount: 42,
          childYansiCount: 99,
          experienceStartedCount: 140,
          directChildYansiCount: 7,
        } as never}
        actions={{
          onPublish: () => undefined,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    expect(screen.getByTestId('yansi-public-metrics')).toHaveTextContent(
      '140 deneyim · 7 Yansı'
    );
    expect(screen.queryByText('42 deneyim')).toBeNull();
  });

  it('same formatter across surfaces', () => {
    const copy = formatYansiPublicSocialProof({
      experienceStartedCount: 140,
      directChildYansiCount: 7,
    });
    expect(copy?.visible).toBe('140 deneyim · 7 Yansı');
    expect(copy?.sr).toBe('140 deneyim, 7 Yansı');
  });
});

describe('Phase 6.2.1 N+1 source audit', () => {
  it('Discover and profile clients never call /metrics', () => {
    const files = [
      'components/saina/SainaDiscoverCard.tsx',
      'components/mirror/ayna/AynaJourneySlide.tsx',
      'components/mirror/ayna/AuthorPublishedYansiProfile.tsx',
      'lib/eza/mirror-network/fetchAuthorPublished.ts',
      'lib/eza/mirror-network/fetchDiscoverMirrors.ts',
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src).not.toContain('fetchYansiPublicMetrics');
      expect(src).not.toContain('/metrics');
    }
  });
});
