/**
 * Mobile Ayna READY opening view + superseded FAILED cleanup + Devamı.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import AynaJourneyReel from '@/components/mirror/ayna/AynaJourneyReel';
import {
  clearAllJourneyConversationStates,
  clearAllMirrorJourneyArtifactsForTests,
  confirmJourneyWindow,
  ensureJourneyWindowRecord,
  listAynaReelArtifacts,
  listJourneyArtifactsForConversation,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  reconcileGeneratingJourneyWindowsWithArtifacts,
  resolveAynaGenerationErrorCopy,
  resolveAynaReelSelectedIdentity,
  saveJourneyConversationState,
  syncJourneyConversationState,
  type JourneyGenerationLineage,
  type JourneyMessageLike,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { loadJourneyConversationState } from '@/lib/eza/mirror/journey/journeyWindowStore';

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

const USER = 'user-mobile-ready';
const CONV = 'conv-mobile-ready';

function msg(id: string, text: string, role: 'user' | 'assistant'): JourneyMessageLike {
  return { id, text, role };
}

function eightMessages(): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 1; i <= 8; i += 1) {
    out.push(msg(`u${i}`, `Soru ${i}?`, 'user'));
    out.push(msg(`a${i}`, `Cevap ${i}.`, 'assistant'));
  }
  return out;
}

function lineage(journeyId: string, blockIndex = 0): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId,
    journeyVersion: 1,
    sourceConversationId: CONV,
    windowIndex: blockIndex,
    windowStart: blockIndex * 8,
    windowEnd: blockIndex * 8 + 7,
    blockIndex,
    windowHash: 'h',
    sourceBlockHash: 'b',
    scopedInputHash: 's',
    selectedStepsHash: 't',
    selectedCount: 8,
    interpretationHash: 'i',
    publicLandingHash: 'p',
    mappedPromptHash: 'm',
    generationId: `gen-${journeyId}`,
    sceneAssetId: 'asset',
    sealedAt: new Date().toISOString(),
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: blockIndex * 8 + i,
      sourceUserMessageId: `u${i + 1}`,
      sourceAssistantMessageId: `a${i + 1}`,
      publicQuestion: `Soru ${i + 1}?`,
      publicAnswer: `Cevap ${i + 1}.`,
    })),
  };
}

function seedWindow(journeyId: string) {
  let state = syncJourneyConversationState({
    state: null,
    ownerUserId: USER,
    sourceConversationId: CONV,
    messages: eightMessages(),
  });
  state = ensureJourneyWindowRecord(state, 0);
  state = confirmJourneyWindow({
    state,
    windowIndex: 0,
    journeyId,
    draftKey: 'draft-0',
    selectedCount: 8,
  });
  saveJourneyConversationState(state);
  markMirrorJourneyArtifactGenerating(USER, {
    journeyId,
    journeyVersion: 1,
    sourceConversationId: CONV,
    blockIndex: 0,
    selectedCount: 8,
  });
}

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
    authorAvatarUrl: 'https://example.com/avatar.png',
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

describe('mobile Ayna READY + superseded FAILED + Devamı', () => {
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

  it('1–3: READY artifact reconciles stale generating and failed windows', () => {
    seedWindow('journey-ready');
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: 'journey-ready',
      journeyVersion: 1,
      message: 'legacy_incompatible_sealed_selection',
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'failed'
    );

    markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineage('journey-ready'),
      sceneImageUrl: 'https://example.com/ready.png',
      publicTitle: 'T',
      publicSummary: 'S',
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'ready'
    );

    let state = loadJourneyConversationState(USER, CONV)!;
    state = {
      ...state,
      windows: state.windows.map((w) =>
        w.windowIndex === 0 ? { ...w, status: 'generating' as const } : w
      ),
    };
    saveJourneyConversationState(state);
    const reconciled = reconcileGeneratingJourneyWindowsWithArtifacts({
      ownerUserId: USER,
      sourceConversationId: CONV,
    });
    expect(reconciled?.windows[0]?.status).toBe('ready');
  });

  it('1,4,18: same-window FAILED superseded by READY is dropped from reel', () => {
    const failed = readyArtifact({
      journeyId: 'journey-fail-attempt',
      blockIndex: 0,
      status: 'failed',
      sceneImageUrl: null,
      publicTitle: 'Eski',
      generationError: 'legacy_incompatible_sealed_selection',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const ready = readyArtifact({
      journeyId: 'journey-ready',
      blockIndex: 0,
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const listed = listAynaReelArtifacts({
      artifacts: [failed, ready],
      routeIdentity: null,
    });
    expect(listed.map((a) => a.journeyId)).toEqual(['journey-ready']);
    expect(listed.some((a) => a.status === 'failed')).toBe(false);

    const selected = resolveAynaReelSelectedIdentity({
      artifacts: [failed, ready],
      routeIdentity: null,
    });
    expect(selected?.journeyId).toBe('journey-ready');
  });

  it('2,4: independent FAILED Yansı on another block is preserved', () => {
    const failed = readyArtifact({
      journeyId: 'journey-independent-fail',
      blockIndex: 0,
      status: 'failed',
      sceneImageUrl: null,
      selectedStepsHash: 'other-hash',
      generationError: 'legacy_incompatible_sealed_selection',
    });
    const ready = readyArtifact({
      journeyId: 'journey-ready',
      blockIndex: 1,
      selectedStepsHash: 't',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const listed = listAynaReelArtifacts({
      artifacts: [failed, ready],
      routeIdentity: null,
    });
    expect(listed).toHaveLength(2);
    expect(listed.find((a) => a.status === 'failed')?.journeyId).toBe(
      'journey-independent-fail'
    );

    const selected = resolveAynaReelSelectedIdentity({
      artifacts: [failed, ready],
      routeIdentity: null,
    });
    expect(selected?.journeyId).toBe('journey-ready');
  });

  it('3: explicit ?yansi= exact route still wins (including FAILED)', () => {
    const failed = readyArtifact({
      journeyId: 'journey-old-fail',
      blockIndex: 0,
      status: 'failed',
      sceneImageUrl: null,
      generationError: 'legacy_incompatible_sealed_selection',
    });
    const ready = readyArtifact({
      journeyId: 'journey-ready',
      blockIndex: 0,
    });
    const routed = resolveAynaReelSelectedIdentity({
      artifacts: [failed, ready],
      routeIdentity: { journeyId: 'journey-old-fail', journeyVersion: 1 },
    });
    expect(routed?.journeyId).toBe('journey-old-fail');
    const listed = listAynaReelArtifacts({
      artifacts: [failed, ready],
      routeIdentity: { journeyId: 'journey-old-fail', journeyVersion: 1 },
    });
    expect(listed.some((a) => a.journeyId === 'journey-old-fail')).toBe(true);
  });

  it('4: default opening selects current READY/published product', () => {
    const selected = resolveAynaReelSelectedIdentity({
      artifacts: [
        readyArtifact({
          journeyId: 'a',
          blockIndex: 0,
          status: 'failed',
          generationError: 'x',
        }),
        readyArtifact({ journeyId: 'b', blockIndex: 1, status: 'published' }),
      ],
      routeIdentity: null,
    });
    expect(selected?.journeyId).toBe('b');
  });

  it('5–6,9–11: mobile compact READY hierarchy + full title + Devamı under summary', () => {
    const fullTitle =
      'Gece Rotası: Sessiz limanın aydınlık kıyısında uzun bir yürüyüş ve dönüş';
    const longSummary =
      'Bu özet oldukça uzun bir metindir ve birincil ekranda kısaltılmalıdır. ' +
      'İkinci cümle de devam eder ve Devamı bölümünde tam görünür.';
    const artifact = readyArtifact({
      publicTitle: fullTitle,
      publicSummary: longSummary,
      authorDisplayName: 'biligN kullanıcısı',
    });
    const storedSummary = artifact.publicSummary;
    const storedTitle = artifact.publicTitle;
    render(
      <AynaJourneySlide
        artifact={artifact}
        actions={noopActions}
        compactPrimaryProduct
      />
    );
    const root = screen.getByTestId('ayna-journey-slide');
    expect(root.getAttribute('data-compact-primary')).toBe('true');

    const visual = root.querySelector('[data-visual-only="true"]') as HTMLElement;
    expect(visual).toBeTruthy();

    const title = screen.getByTestId('ayna-slide-title');
    const preview = screen.getByTestId('ayna-summary-preview');
    const devami = screen.getByTestId('ayna-slide-devami');
    const status = screen.getByTestId('ayna-slide-status');
    const publish = screen.getByTestId('mirror-publish-btn');
    const detail = screen.getByTestId('ayna-slide-detail');

    // Approved order: visual → full title → summary preview → Devamı → status → CTA
    expect(
      visual.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      title.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      preview.compareDocumentPosition(devami) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      devami.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      status.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      publish.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(title.textContent).toBe(fullTitle);
    expect(artifact.publicTitle).toBe(storedTitle);
    expect(screen.queryByText(/biligN/)).toBeNull();
    expect(root.querySelector('[data-testid="ayna-author-row"]')).toBeNull();
    expect(screen.queryByTestId('ayna-slide-secondary')).toBeNull();

    expect(preview.textContent).toBe(longSummary);
    expect(artifact.publicSummary).toBe(storedSummary);
    expect(detail.textContent).toContain(longSummary);
    expect(devami.textContent).toBe('Devamı');
  });

  it('7,17: desktop author row remains; genuine failure shows safe retry UX', () => {
    const { unmount: unmountDesktop } = render(
      <AynaJourneySlide artifact={readyArtifact()} actions={noopActions} />
    );
    expect(
      screen.getByTestId('ayna-journey-slide').getAttribute('data-compact-primary')
    ).toBeNull();
    expect(screen.getByText(/biligN/)).toBeTruthy();
    expect(screen.queryByTestId('ayna-slide-devami')).toBeNull();
    unmountDesktop();

    const failed = readyArtifact({
      status: 'failed',
      sceneImageUrl: null,
      generationError: 'legacy_incompatible_sealed_selection',
    });
    render(<AynaJourneySlide artifact={failed} actions={noopActions} />);
    expect(screen.getByTestId('ayna-slide-failed')).toBeTruthy();
    expect(screen.getByText('Yansı oluşturulamadı.')).toBeTruthy();
    expect(screen.queryByText('legacy_incompatible_sealed_selection')).toBeNull();
    expect(screen.getByText(/kayıtlı seçim bulunamadı/i)).toBeTruthy();
    expect(screen.getByTestId('ayna-slide-retry')).toBeTruthy();
  });

  it('10: resolveAynaGenerationErrorCopy maps internal codes safely', () => {
    expect(resolveAynaGenerationErrorCopy('legacy_incompatible_sealed_selection')).toMatch(
      /kayıtlı seçim/
    );
    expect(resolveAynaGenerationErrorCopy('some_internal_code')).toMatch(
      /Yansı oluşturulamadı/
    );
    expect(
      resolveAynaGenerationErrorCopy('Scoped message A1 does not match selectedSteps')
    ).toMatch(/doğrulanamadı/);
  });

  it('12–14: Devamı scrolls reel slide detail; reopen resets scroll', () => {
    const artifact = readyArtifact();
    render(
      <AynaJourneySlide
        artifact={artifact}
        actions={noopActions}
        compactPrimaryProduct
      />
    );
    fireEvent.click(screen.getByTestId('ayna-slide-devami'));
    const detail = screen.getByTestId('ayna-slide-detail');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(detail.id).toBe(
      `ayna-detail-${artifact.journeyId}-v${artifact.journeyVersion}`
    );

    const scrollIntoView = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scrollIntoView.mockClear();

    const { unmount } = render(
      <AynaJourneyReel
        artifacts={[artifact]}
        actions={noopActions}
        compactPrimaryProduct
        selectedArtifactIdentity={{
          journeyId: artifact.journeyId,
          journeyVersion: artifact.journeyVersion,
        }}
      />
    );
    const reel = screen.getByTestId('ayna-journey-reel');
    Object.defineProperty(reel, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 240,
    });
    unmount();

    render(
      <AynaJourneyReel
        artifacts={[artifact]}
        actions={noopActions}
        compactPrimaryProduct
        selectedArtifactIdentity={{
          journeyId: artifact.journeyId,
          journeyVersion: artifact.journeyVersion,
        }}
      />
    );
    expect(screen.getByTestId('ayna-journey-reel').scrollTop).toBe(0);
  });

  it('15–16: mobile CSS fit-first visual + single scroll owner', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/saina-yansi-desktop.css'),
      'utf8'
    );
    expect(css).toMatch(
      /\.saina-mobile-ayna-sheet-body\s*\{[\s\S]*?overflow:\s*hidden/
    );
    expect(css).toMatch(
      /\.saina-mobile-ayna-sheet-body \.ayna-journey-reel\s*\{[\s\S]*?overflow-y:\s*auto/
    );
    expect(css).toContain('calc(100dvh - 22rem)');
    expect(css).toContain('ayna-journey-slide__devami');
    expect(css).toContain('saina-discover-card--visual-only');
    expect(css).toMatch(
      /\.saina-mobile-ayna-sheet-body \.saina-mirror-how\s*\{[\s\S]*?display:\s*none/
    );
  });

  it('8,19–20: public /m and ObservationExperience wiring unchanged for identity', () => {
    const obs = readFileSync(
      join(
        process.cwd(),
        'components/standalone/StandaloneObservationExperience.tsx'
      ),
      'utf8'
    );
    expect(obs).toContain('listAynaReelArtifacts');
    expect(obs).toContain('resolveAynaReelSelectedIdentity');
    expect(obs).toContain('compactPrimaryProduct');
    expect(obs).toContain('reconcileGeneratingJourneyWindowsWithArtifacts');
    expect(obs).toContain('useSainaCompactShell');

    const publicM = readFileSync(
      join(process.cwd(), 'app/m/[slug]/page.tsx'),
      'utf8'
    );
    expect(publicM).not.toContain('compactPrimaryProduct');
    expect(publicM).not.toContain('ayna-slide-devami');
  });

  it('7: ready after fail leaves one artifact identity', () => {
    seedWindow('journey-one');
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: 'journey-one',
      journeyVersion: 1,
      message: 'fail',
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: 'journey-one',
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineage('journey-one'),
      sceneImageUrl: 'https://example.com/one.png',
      publicTitle: 'T',
      publicSummary: 'S',
    });
    const listed = listJourneyArtifactsForConversation(USER, CONV);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('ready');
    expect(listed[0]?.generationError).toBeNull();
  });

  it('source: mobile CSS keeps full title; clamps summary only', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/saina-yansi-desktop.css'),
      'utf8'
    );
    expect(css).toMatch(
      /\.saina-mobile-ayna-sheet-body \.ayna-journey-slide__title\s*\{[\s\S]*?-webkit-line-clamp:\s*unset/
    );
    expect(css).toMatch(
      /\.saina-mobile-ayna-sheet-body \.ayna-journey-slide__summary--preview\s*\{[\s\S]*?-webkit-line-clamp:\s*2/
    );
    const slideSrc = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AynaJourneySlide.tsx'),
      'utf8'
    );
    const previewIdx = slideSrc.indexOf('ayna-summary-preview');
    const devamiIdx = slideSrc.indexOf('data-testid="ayna-slide-devami"');
    // First publicationBlock after Devamı in compact branch (second is desktop).
    const pubAfterDevami = slideSrc.indexOf('{publicationBlock}', devamiIdx);
    expect(previewIdx).toBeGreaterThan(-1);
    expect(devamiIdx).toBeGreaterThan(previewIdx);
    expect(pubAfterDevami).toBeGreaterThan(devamiIdx);
  });

  it('source: reel resets scrollTop then scrollIntoView start on selection', () => {
    const reelSrc = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AynaJourneyReel.tsx'),
      'utf8'
    );
    expect(reelSrc).toContain('root.scrollTop = 0');
    expect(reelSrc).toContain("block: 'start'");
  });
});
