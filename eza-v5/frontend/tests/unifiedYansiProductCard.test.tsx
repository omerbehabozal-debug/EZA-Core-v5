/**
 * Unified Yansı product card — Ayna preview ≡ Discover published product.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';
import {
  resolveYansiProductFromArtifact,
  resolveYansiProductFromDiscoverItem,
} from '@/lib/eza/mirror/yansiProductPresentation';
import { MIRROR_JOURNEY_STATUS_READY } from '@/lib/eza/mirror/copy';
import { SAINA_MIRROR_HOW_LABEL } from '@/lib/eza/sainaCopy';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey';
import {
  buildCuriosityCard,
  endsIncompletely,
  isCriteriaOnlyTitle,
} from '@/lib/eza/mirror/curiosityBuilder';
import { MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION } from '@/lib/eza/mirror/semanticAnchors/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/hooks/useResolvedProfileAvatar', () => ({
  useResolvedProfileAvatar: () => ({ url: null, revision: undefined }),
}));

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

const SCENE = 'https://cdn.example/exact-yansi.png';
const TITLE = 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark';
const SUMMARY =
  'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı his ve konforun belirlediğini gösteriyor.';

function artifactA(
  overrides: Partial<MirrorJourneyArtifact> = {}
): MirrorJourneyArtifact {
  return {
    journeyId: 'journey-a',
    journeyVersion: 1,
    sourceConversationId: 'conv-shared',
    blockIndex: 0,
    generationId: 'gen-a',
    selectedCount: 8,
    selectedStepsHash: 'hash-a',
    sceneImageUrl: SCENE,
    publicTitle: TITLE,
    publicSummary: SUMMARY,
    status: 'ready',
    publish: {},
    sealedLineage: null,
    authorDisplayName: 'Owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    stateVersion: 1,
    ...overrides,
  };
}

const noopActions = {
  onPublish: () => undefined,
  onShare: () => undefined,
  onOpenDiscover: () => undefined,
  onOpenAuthorProfile: () => undefined,
  onOpenParent: () => undefined,
};

describe('unified Yansı product card contract', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('Ayna and Discover share YansiProductCard + same product field authority', () => {
    const aynaSrc = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AynaJourneySlide.tsx'),
      'utf8'
    );
    const discoverSrc = readFileSync(
      join(process.cwd(), 'components/saina/SainaDiscoverCard.tsx'),
      'utf8'
    );
    expect(aynaSrc).toContain('YansiProductCard');
    expect(aynaSrc).toContain('resolveYansiProductFromArtifact');
    expect(aynaSrc).not.toContain('AynaAuthorRow');
    expect(aynaSrc).not.toContain('ayna-summary-toggle');
    expect(aynaSrc).not.toContain('visibleSummary');
    expect(discoverSrc).toContain('YansiProductCard');
    expect(discoverSrc).toContain('resolveYansiProductFromDiscoverItem');
  });

  it('canonical card geometry: visual is full product width (no side strip)', () => {
    const mirrorCss = readFileSync(
      join(process.cwd(), 'styles/saina-mirror.css'),
      'utf8'
    );
    const yansiCss = readFileSync(
      join(process.cwd(), 'styles/saina-yansi-desktop.css'),
      'utf8'
    );
    const card = readFileSync(
      join(process.cwd(), 'components/mirror/MirrorPublicCard.tsx'),
      'utf8'
    );

    expect(card).toContain('saina-discover-card__visual');
    expect(card).toContain('saina-discover-card__image');
    expect(card).toContain('data-yansi-product-core');

    expect(mirrorCss).toMatch(
      /\.saina-discover-card__visual\s*\{[^}]*width:\s*100%/s
    );
    expect(mirrorCss).toMatch(
      /\.saina-discover-card__visual\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s
    );
    expect(mirrorCss).toMatch(
      /\.saina-discover-card__image\s*\{[^}]*width:\s*100%/s
    );
    expect(mirrorCss).toMatch(
      /\.saina-discover-card__image\s*\{[^}]*object-fit:\s*cover/s
    );
    expect(mirrorCss).toContain(
      '.saina-discover-card--canonical-product .saina-discover-card__visual'
    );

    // Ayna must not shrink the 1:1 visual narrower than the card via max-height.
    expect(yansiCss).not.toMatch(
      /\.saina-mobile-ayna-sheet-body[\s\S]*?\.saina-discover-card__visual\s*\{[^}]*max-height:\s*min\(/s
    );
    expect(yansiCss).toMatch(
      /\.saina-mobile-ayna-sheet-body[\s\S]*?\.saina-discover-card__visual\s*\{[^}]*width:\s*100%/s
    );
    expect(yansiCss).toMatch(
      /\.saina-mobile-ayna-sheet-body[\s\S]*?\.saina-discover-card__visual\s*\{[^}]*max-height:\s*none/s
    );
    expect(yansiCss).toMatch(
      /\.saina-mirror-panel[\s\S]*?\.saina-discover-card__visual\s*\{[^}]*width:\s*100%/s
    );
    expect(yansiCss).toMatch(
      /\.saina-mirror-panel[\s\S]*?\.saina-discover-card__visual\s*\{[^}]*max-height:\s*none/s
    );
  });

  it('mobile and desktop Ayna both use YansiProductCard without separate title/summary', () => {
    const longSummary =
      'Canonical public summary that must match Discover without truncation expand.'
        .repeat(3)
        .trim();
    const a = artifactA({
      publicSummary: longSummary,
      authorDisplayName: 'Should Not Appear',
    });

    const { rerender } = render(
      <AynaJourneySlide
        artifact={a}
        actions={noopActions}
        compactPrimaryProduct
        positionLabel="1 / 1"
      />
    );
    expect(
      document.querySelectorAll('[data-canonical-yansi-product="true"]').length
    ).toBe(1);
    expect(screen.getByTestId('ayna-slide-journey-a-title').textContent).toBe(TITLE);
    expect(screen.getByTestId('ayna-slide-journey-a-summary').textContent).toBe(
      longSummary
    );
    expect(screen.queryByText('Should Not Appear')).toBeNull();
    expect(screen.queryByTestId('ayna-slide-position')).toBeNull();
    expect(screen.queryByTestId('ayna-summary-toggle')).toBeNull();

    rerender(
      <AynaJourneySlide
        artifact={a}
        actions={noopActions}
        positionLabel="2 / 2"
      />
    );
    expect(
      document.querySelectorAll('[data-canonical-yansi-product="true"]').length
    ).toBe(1);
    expect(screen.getByTestId('ayna-slide-journey-a-title').textContent).toBe(TITLE);
    expect(screen.getByTestId('ayna-slide-journey-a-summary').textContent).toBe(
      longSummary
    );
    expect(screen.queryByText('Should Not Appear')).toBeNull();
    expect(screen.queryByTestId('ayna-slide-position')).toBeNull();
    expect(screen.queryByTestId('ayna-summary-toggle')).toBeNull();
    expect(screen.queryByText(SAINA_MIRROR_HOW_LABEL)).toBeNull();
  });

  it('same scene / title / summary for artifact ↔ Discover projection', () => {
    const a = artifactA();
    const fromArtifact = resolveYansiProductFromArtifact(a);
    const fromDiscover = resolveYansiProductFromDiscoverItem({
      title: a.publicTitle!,
      description: a.publicSummary!,
      sceneImageUrl: a.sceneImageUrl!,
    });
    expect(fromArtifact).toEqual(fromDiscover);
    expect(fromArtifact.sceneImageUrl).toBe(SCENE);
    expect(fromArtifact.title).toBe(TITLE);
    expect(fromArtifact.summary).toBe(SUMMARY);
  });

  it('Ayna READY and Discover render identical product core fields', () => {
    const a = artifactA();
    const { rerender } = render(
      <AynaJourneySlide
        artifact={a}
        actions={noopActions}
        compactPrimaryProduct
      />
    );
    expect(
      screen.getByTestId('ayna-slide-journey-a-title').textContent
    ).toBe(TITLE);
    expect(
      screen.getByTestId('ayna-slide-journey-a-summary').textContent
    ).toBe(SUMMARY);
    expect(
      screen.getByTestId('ayna-slide-journey-a-image').getAttribute('src')
    ).toBe(SCENE);
    expect(document.querySelector('[data-canonical-yansi-product="true"]')).toBeTruthy();
    expect(document.querySelector('[data-yansi-product-core]')).toBeTruthy();
    expect(TITLE.includes('…')).toBe(false);
    expect(screen.getByTestId('ayna-slide-status').textContent).toContain(
      MIRROR_JOURNEY_STATUS_READY
    );
    expect(MIRROR_JOURNEY_STATUS_READY).toBe('Yayına hazır');

    rerender(
      <SainaDiscoverCard
        item={{
          slug: 'slug-a',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          authorDisplayName: 'Creator Name',
          yansiCount: 1,
          experienceStartedCount: 3,
          directChildYansiCount: 1,
        }}
      />
    );
    expect(screen.getByTestId('saina-discover-card-title-slug-a').textContent).toBe(
      TITLE
    );
    expect(
      screen.getByTestId('saina-discover-card-summary-slug-a').textContent
    ).toBe(SUMMARY);
    expect(screen.getByTestId('saina-discover-card-image').getAttribute('src')).toBe(
      SCENE
    );
    expect(
      screen.getByTestId('saina-discover-card-identity-slug-a')
    ).toBeTruthy();
    expect(screen.getByTestId('saina-discover-card-cta-slug-a')).toBeTruthy();
  });

  it('A/B/C exact artifact identity preserved independently', () => {
    const a = resolveYansiProductFromArtifact(
      artifactA({ journeyId: 'a', publicTitle: 'Title A', sceneImageUrl: 'https://cdn/a.png' })
    );
    const b = resolveYansiProductFromArtifact(
      artifactA({ journeyId: 'b', publicTitle: 'Title B', sceneImageUrl: 'https://cdn/b.png' })
    );
    const c = resolveYansiProductFromArtifact(
      artifactA({ journeyId: 'c', publicTitle: 'Title C', sceneImageUrl: 'https://cdn/c.png' })
    );
    expect(a.title).toBe('Title A');
    expect(b.title).toBe('Title B');
    expect(c.title).toBe('Title C');
    expect(a.sceneImageUrl).not.toBe(b.sceneImageUrl);
    expect(b.sceneImageUrl).not.toBe(c.sceneImageUrl);
  });

  it('sealedPublicLanding wins when top-level fields empty', () => {
    const product = resolveYansiProductFromArtifact(
      artifactA({
        publicTitle: '',
        publicSummary: '',
        sealedPublicLanding: {
          publicTitle: 'Sealed Title',
          publicSummary: 'Sealed summary.',
        },
      })
    );
    expect(product.title).toBe('Sealed Title');
    expect(product.summary).toBe('Sealed summary.');
  });

  it('READY Ayna omits metrics and author; Discover keeps them', () => {
    render(
      <AynaJourneySlide
        artifact={artifactA({
          authorDisplayName: 'Should Hide',
          experienceStartedCount: 9,
          directChildYansiCount: 2,
        } as Partial<MirrorJourneyArtifact>)}
        actions={noopActions}
        compactPrimaryProduct
      />
    );
    expect(screen.queryByText('Should Hide')).toBeNull();
    expect(screen.queryByTestId('ayna-slide-position')).toBeNull();

    render(
      <SainaDiscoverCard
        item={{
          slug: 'keep-identity',
          title: TITLE,
          description: SUMMARY,
          sceneImageUrl: SCENE,
          authorDisplayName: 'Keep Me',
          yansiCount: 0,
          experienceStartedCount: 4,
          directChildYansiCount: 0,
        }}
      />
    );
    expect(screen.getByTestId('saina-discover-card-identity-keep-identity')).toHaveTextContent(
      'Keep Me'
    );
  });

  it('generation: known conversation rejects criteria-only title', () => {
    const broken =
      'Çocukken büyüyünce hayatımın nasıl olacağını çok farklı hayal ed';
    const card = buildCuriosityCard({
      anchors: {
        contractVersion: MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION,
        place: null,
        scene: [],
        emotion: [],
        topic: broken,
        userIntent: broken,
        decisionCriteria: ['his', 'konfor'],
        question:
          'Çocukken büyüyünce hayatımın nasıl olacağını çok farklı hayal etmiştim; kararı ne belirliyor?',
        anchorsHash: 'childhood',
        evidenceCount: 1,
      },
      interpretation: {
        title: broken,
        interpretationSummary: SUMMARY,
        imageIntent: 'Reflective mood.',
        atmosphereHint: 'soft',
      },
      locale: 'tr',
    });
    expect(card.publicTitle).not.toMatch(/^His,\s*konfor/i);
    expect(isCriteriaOnlyTitle(card.publicTitle, 'his, konfor')).toBe(false);
    expect(card.publicTitle.length).toBeLessThanOrEqual(64);
    expect(endsIncompletely(card.publicTitle)).toBe(false);
    expect(card.publicTitle.toLowerCase()).toMatch(/hayal|yaşam|hayat|çocuk/i);
    expect(card.publicSummary).toContain('hayaller');
  });

  it('public /m landing does not import YansiProductCard (frozen surface)', () => {
    const landing = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorLandingExperience.tsx'),
      'utf8'
    );
    expect(landing).not.toContain('YansiProductCard');
  });
});
