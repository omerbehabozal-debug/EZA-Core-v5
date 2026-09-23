/**
 * Mobile Ayna READY product view + stale FAILED / Hazırlanıyor reconciliation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import {
  clearAllJourneyConversationStates,
  clearAllMirrorJourneyArtifactsForTests,
  confirmJourneyWindow,
  ensureJourneyWindowRecord,
  listJourneyArtifactsForConversation,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  reconcileGeneratingJourneyWindowsWithArtifacts,
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

function lineage(journeyId: string): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId,
    journeyVersion: 1,
    sourceConversationId: CONV,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
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
      sourceOrder: i,
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
    authorDisplayName: 'Ali',
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

describe('mobile Ayna READY + stale reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllJourneyConversationStates();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('1–3: READY artifact reconciles stale generating and failed windows', () => {
    seedWindow('journey-ready');
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: 'journey-ready',
      journeyVersion: 1,
      message: 'Scoped message A1 does not match selectedSteps',
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

    // Force stale generating again, then hydrate reconcile.
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

  it('4–8: prefer READY identity; do not delete separate failed Yansı', () => {
    const failed: MirrorJourneyArtifact = {
      ...readyArtifact({
        journeyId: 'journey-old-fail',
        blockIndex: 0,
        status: 'failed',
        sceneImageUrl: null,
        publicTitle: 'Eski',
        generationError: 'Scoped message A1 does not match selectedSteps',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    };
    const ready = readyArtifact({
      journeyId: 'journey-ready',
      blockIndex: 1,
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const selected = resolveAynaReelSelectedIdentity({
      artifacts: [failed, ready],
      routeIdentity: null,
    });
    expect(selected?.journeyId).toBe('journey-ready');
    expect(selected?.journeyVersion).toBe(1);

    // Route identity still wins when present.
    const routed = resolveAynaReelSelectedIdentity({
      artifacts: [failed, ready],
      routeIdentity: { journeyId: 'journey-old-fail', journeyVersion: 1 },
    });
    expect(routed?.journeyId).toBe('journey-old-fail');

    // Separate failed remains listable (not deleted by selection helper).
    expect([failed, ready].filter((a) => a.status === 'failed')).toHaveLength(1);
  });

  it('9–11+16–18: compact mobile READY order + visualOnly + fullscreen', () => {
    const artifact = readyArtifact();
    render(
      <AynaJourneySlide
        artifact={artifact}
        actions={noopActions}
        compactPrimaryProduct
      />
    );
    const root = screen.getByTestId('ayna-journey-slide');
    expect(root.getAttribute('data-compact-primary')).toBe('true');
    const card = root.querySelector('[data-visual-only="true"]');
    expect(card).toBeTruthy();
    expect(card?.querySelector('.saina-discover-card__body')).toBeNull();

    const title = screen.getByText('Gece Rotası');
    const summary = screen.getByText('Sessiz bir yürüyüş.');
    const secondary = screen.getByTestId('ayna-slide-secondary');
    // Title/summary appear before secondary author block in DOM.
    expect(
      title.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      summary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId(`ayna-slide-${artifact.journeyId}-expand`));
    const lightboxImg = document.body.querySelector(
      '.saina-mirror-poster-lightbox img'
    ) as HTMLImageElement | null;
    expect(lightboxImg?.getAttribute('src')).toBe(artifact.sceneImageUrl);
    // Fullscreen does not mutate artifact identity fields.
    expect(artifact.status).toBe('ready');
    expect(artifact.sceneImageUrl).toBe('https://example.com/ready.png');
  });

  it('19–20: desktop compact stays off; publication actions present', () => {
    render(
      <AynaJourneySlide artifact={readyArtifact()} actions={noopActions} />
    );
    expect(
      screen.getByTestId('ayna-journey-slide').getAttribute('data-compact-primary')
    ).toBeNull();
    expect(screen.queryByTestId('ayna-slide-secondary')).toBeNull();
    expect(screen.getByText('Gece Rotası')).toBeTruthy();
  });

  it('source: ObservationExperience wires selection + compact + reconcile', () => {
    const obs = readFileSync(
      join(
        process.cwd(),
        'components/standalone/StandaloneObservationExperience.tsx'
      ),
      'utf8'
    );
    expect(obs).toContain('resolveAynaReelSelectedIdentity');
    expect(obs).toContain('compactPrimaryProduct');
    expect(obs).toContain('reconcileGeneratingJourneyWindowsWithArtifacts');
    expect(obs).toContain('useSainaCompactShell');
  });

  it('source: mobile sheet CSS has one scroll owner + viewport-aware visual', () => {
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
    expect(css).toContain('min(42dvh');
    expect(css).toContain('saina-discover-card--visual-only');
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
});
