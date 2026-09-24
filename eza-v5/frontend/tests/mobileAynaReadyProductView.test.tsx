/**
 * Mobile Ayna READY cleanup + complete title/summary generation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import AynaJourneyReel from '@/components/mirror/ayna/AynaJourneyReel';
import {
  buildCuriosityCard,
  composeCompleteTitle,
  clampAtWordBoundary,
  endsIncompletely,
  isCriteriaOnlyTitle,
} from '@/lib/eza/mirror/curiosityBuilder';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import { MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION } from '@/lib/eza/mirror/semanticAnchors/types';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import {
  clearAllJourneyConversationStates,
  clearAllMirrorJourneyArtifactsForTests,
  listAynaReelArtifacts,
  resolveAynaReelSelectedIdentity,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { SAINA_MIRROR_HOW_LABEL } from '@/lib/eza/sainaCopy';

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

const CONV = 'conv-ready-cleanup';

function readyArtifact(overrides: Partial<MirrorJourneyArtifact> = {}): MirrorJourneyArtifact {
  return {
    journeyId: 'journey-ready',
    journeyVersion: 1,
    sourceConversationId: CONV,
    blockIndex: 0,
    generationId: 'gen',
    selectedCount: 8,
    selectedStepsHash: 't',
    sceneImageUrl: 'https://example.com/ready.png',
    publicTitle: 'Gece Rotası',
    publicSummary: 'Sessiz bir yürüyüş.',
    status: 'ready',
    publish: {},
    sealedLineage: null,
    authorDisplayName: 'biligN',
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
  onRetry: () => undefined,
};

const BROKEN_64 =
  'Çocukken büyüyünce hayatımın nasıl olacağını çok farklı hayal ed';
const BROKEN_TITLE =
  'Çocukken büyüyünce hayatımın nasıl olacağını çok farklı hayal';
const LONG_QUESTION =
  'Çocukken büyüyünce hayatımın nasıl olacağını çok farklı hayal etmiştim; şimdi asıl soru kararı neyin verdiği';

function childhoodAnchors(): MirrorSemanticAnchorsV1 {
  return {
    contractVersion: MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION,
    place: null,
    scene: [],
    emotion: ['düşünsel'],
    topic: BROKEN_64,
    userIntent: BROKEN_64,
    decisionCriteria: ['his', 'konfor'],
    question: LONG_QUESTION,
    anchorsHash: 'childhood-test',
    evidenceCount: 2,
  };
}

const childhoodInterpretation: MirrorInterpretationV1 = {
  title: BROKEN_64.slice(0, 64),
  interpretationSummary:
    'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı his ve konforun belirlediğini gösteriyor.',
  rationale: 'Childhood expectation versus lived life.',
  imageIntent: 'Quiet reflective interior mood.',
  visualNarrative:
    'A still room where memory of childhood dreams meets the quiet of adult life.',
  atmosphereHint: 'reflective, soft',
  topicCategory: 'life',
  confidence: 0.85,
};

describe('mobile Ayna READY cleanup + complete title/summary', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllJourneyConversationStates();
    clearAllMirrorJourneyArtifactsForTests();
    Element.prototype.scrollIntoView = vi.fn();
    // @ts-expect-error test stub
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('READY compact: canonical product card → Yayına hazır → Yayınla; no Devamı/how/1-1/author', () => {
    render(
      <AynaJourneySlide
        artifact={readyArtifact({ authorDisplayName: 'biligN kullanıcısı' })}
        actions={noopActions}
        compactPrimaryProduct
        positionLabel="1 / 1"
      />
    );
    const root = screen.getByTestId('ayna-journey-slide');
    const product = root.querySelector('[data-canonical-yansi-product="true"]');
    expect(product).toBeTruthy();
    expect(root.querySelector('[data-visual-only="true"]')).toBeNull();
    expect(root.querySelector('[data-yansi-product-core]')).toBeTruthy();
    expect(
      screen.getByTestId('ayna-slide-journey-ready-title').textContent
    ).toBe('Gece Rotası');
    expect(
      screen.getByTestId('ayna-slide-journey-ready-summary').textContent
    ).toBe('Sessiz bir yürüyüş.');
    expect(screen.getByTestId('ayna-slide-status').textContent).toMatch(
      /Yayına hazır/
    );
    expect(screen.getByTestId('ayna-slide-publication')).toBeTruthy();
    expect(screen.getByTestId('mirror-publish-btn')).toBeTruthy();

    expect(screen.queryByTestId('ayna-slide-devami')).toBeNull();
    expect(screen.queryByTestId('ayna-slide-detail')).toBeNull();
    expect(screen.queryByText(SAINA_MIRROR_HOW_LABEL)).toBeNull();
    expect(screen.queryByTestId('ayna-slide-position')).toBeNull();
    expect(screen.queryByText(/biligN/)).toBeNull();
    expect(screen.queryAllByText('Sessiz bir yürüyüş.')).toHaveLength(1);
  });

  it('desktop keeps author and may show position; no compact Devamı', () => {
    render(
      <AynaJourneySlide
        artifact={readyArtifact()}
        actions={noopActions}
        positionLabel="1 / 1"
      />
    );
    expect(screen.getByText(/biligN/)).toBeTruthy();
    expect(screen.getByTestId('ayna-slide-position').textContent).toBe('1 / 1');
    expect(screen.queryByTestId('ayna-slide-devami')).toBeNull();
  });

  it('reel omits positionLabel when compactPrimaryProduct', () => {
    render(
      <AynaJourneyReel
        artifacts={[readyArtifact()]}
        actions={noopActions}
        compactPrimaryProduct
        selectedArtifactIdentity={{ journeyId: 'journey-ready', journeyVersion: 1 }}
      />
    );
    expect(screen.queryByTestId('ayna-slide-position')).toBeNull();
  });

  it('panel how is gated to empty state in source', () => {
    const panel = readFileSync(
      join(process.cwd(), 'components/saina/SainaStandaloneMirrorPanel.tsx'),
      'utf8'
    );
    expect(panel).toContain('hasReadyOrPublishedYansi');
    expect(panel).toContain('ayna-how-empty');
    expect(panel).toMatch(/!hasReadyOrPublishedYansi/);
  });

  it('superseded FAILED still dropped from READY reel', () => {
    const failed = readyArtifact({
      journeyId: 'fail',
      status: 'failed',
      generationError: 'legacy_incompatible_sealed_selection',
      sceneImageUrl: null,
    });
    const ready = readyArtifact({ journeyId: 'ok' });
    expect(
      listAynaReelArtifacts({ artifacts: [failed, ready], routeIdentity: null }).map(
        (a) => a.journeyId
      )
    ).toEqual(['ok']);
    expect(
      resolveAynaReelSelectedIdentity({
        artifacts: [failed, ready],
        routeIdentity: null,
      })?.journeyId
    ).toBe('ok');
  });

  it('title helpers never mid-word cut; reject known broken title', () => {
    expect(BROKEN_64.length).toBe(64);
    expect(endsIncompletely(BROKEN_64)).toBe(true);
    const clamped = clampAtWordBoundary(`${BROKEN_64}miştim ekstra`, 64);
    expect(clamped.includes(' ')).toBe(true);
    expect(clamped.endsWith('edmiş') || clamped.endsWith('miş')).toBe(false);

    const title = composeCompleteTitle(BROKEN_64, 'tr', 'his ve konfor', {
      interpretationSummary: childhoodInterpretation.interpretationSummary,
      topic: BROKEN_64,
      userIntent: BROKEN_64,
      question: LONG_QUESTION,
    });
    expect(title).not.toBe(BROKEN_TITLE);
    expect(title).not.toMatch(/^His,\s*konfor/i);
    expect(title.toLowerCase()).not.toMatch(/çok farklı hayal$/);
    expect(title.length).toBeLessThanOrEqual(64);
    expect(endsIncompletely(title)).toBe(false);
    expect(title.toLowerCase()).toMatch(/hayal|yaşam|hayat|çocuk/i);
  });

  it('long question produces concise complete title + safe summary', () => {
    const card = buildCuriosityCard({
      anchors: childhoodAnchors(),
      interpretation: childhoodInterpretation,
      locale: 'tr',
    });
    expect(card.publicTitle.length).toBeLessThanOrEqual(64);
    expect(card.publicTitle).not.toBe(BROKEN_TITLE);
    expect(card.publicTitle).not.toMatch(/hayal ed$/i);
    expect(card.publicTitle).not.toMatch(/^His,\s*konfor/i);
    expect(isCriteriaOnlyTitle(card.publicTitle, 'his, konfor')).toBe(false);
    expect(endsIncompletely(card.publicTitle)).toBe(false);
    expect(card.publicTitle.toLowerCase()).toMatch(/hayal|yaşam|hayat|çocuk/i);

    expect(card.publicSummary).not.toMatch(/hayal ed —/);
    expect(card.publicSummary).not.toContain(BROKEN_64);
    expect(card.publicSummary.length).toBeLessThanOrEqual(320);
    expect(card.publicSummary.length).toBeGreaterThan(20);

    const landing = buildPublicMirrorLandingFromInterpretation(childhoodInterpretation, {
      locale: 'tr',
      semanticAnchors: childhoodAnchors(),
    });
    expect(landing.publicTitle).not.toBe(BROKEN_TITLE);
    expect(landing.publicTitle).not.toMatch(/^His,\s*konfor/i);
    expect(landing.publicTitle.length).toBeLessThanOrEqual(64);
    expect(landing.publicSummary).not.toMatch(/hayal ed —/);
  });

  it('criteria cannot become the entire title when a usable theme exists', () => {
    const title = composeCompleteTitle(
      BROKEN_64,
      'tr',
      'para ve güven',
      {
        interpretationSummary:
          'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı para ve güvenin belirlediğini gösteriyor.',
        question: LONG_QUESTION,
        topic: BROKEN_64,
        userIntent: BROKEN_64,
      }
    );
    expect(title).not.toMatch(/^Para,\s*güven/i);
    expect(title).not.toMatch(/^Para ve güven/i);
    expect(isCriteriaOnlyTitle(title, 'para ve güven')).toBe(false);
    expect(title.toLowerCase()).toMatch(/hayal|yaşam|hayat|çocuk/i);
  });

  it('landing polishTitle does not mid-word slice', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/publicMirrorLanding.ts'),
      'utf8'
    );
    expect(src).toContain('clampAtWordBoundary');
    expect(src).not.toMatch(/function polishTitle[\s\S]*clean\(raw,\s*TITLE_MAX\)/);
  });
});
