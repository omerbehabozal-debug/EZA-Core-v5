import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import YansiContentIdentityLine from '@/components/mirror-landing/YansiContentIdentityLine';
import YansiDesktopReelSurface from '@/components/mirror-landing/YansiDesktopReelSurface';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  classifyContentIdentityEcho,
  contentIdentityRequestFields,
  YANSI_IDENTITY_UNCONFIRMED_MESSAGE,
} from '@/lib/eza/mirror/journey/yansiContentIdentity';
import type { JourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/hooks/useResolvedProfileAvatar', () => ({
  useResolvedProfileAvatar: () => ({ url: null, revision: undefined }),
}));

function lineage(): JourneyGenerationLineage {
  const steps = Array.from({ length: 6 }, (_, index) => ({
    stepIndex: index + 1,
    sourceOrder: index,
    sourceUserMessageId: `u${index}`,
    sourceAssistantMessageId: `a${index}`,
    publicQuestion: `Soru ${index + 1}`,
    publicAnswer: `Cevap ${index + 1}`,
  }));
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: 'yansi-kimlik',
    journeyVersion: 1,
    sourceConversationId: 'conv-1',
    parentJourneyId: null,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 5,
    blockIndex: 0,
    windowHash: 'wh',
    scopedInputHash: 'sih',
    selectedStepsHash: 'ssh',
    interpretationHash: 'ih',
    publicLandingHash: 'plh',
    mappedPromptHash: 'mph',
    generationId: 'gen-1',
    sceneAssetId: 'asset-1',
    sceneImageUrl: 'https://cdn.example/scene.jpg',
    selectedSteps: steps,
    sealedAt: '2026-10-28T00:00:00.000Z',
  };
}

function artifact(overrides?: Partial<PublicFrozenJourneyArtifact>): PublicFrozenJourneyArtifact {
  return {
    slug: 'yansi-kimlik',
    journeyId: 'yansi-kimlik',
    journeyVersion: 1,
    publicTitle: 'Kapak başlığı',
    publicSummary: 'Kısa özet',
    sceneImageUrl: 'https://cdn.example/scene.jpg',
    authorUserId: 'owner-1',
    selectedCount: 6,
    steps: Array.from({ length: 6 }, (_, index) => ({
      stepIndex: index + 1,
      publicQuestion: `Soru ${index + 1}`,
      publicAnswer: `Cevap ${index + 1}`,
    })),
    publishedAt: '2026-10-28T12:00:00.000Z',
    replayReady: true,
    ...overrides,
  };
}

describe('Yansı content identity', () => {
  it('keeps an unlabeled frozen artifact on the old shape', () => {
    const parsed = parsePublicFrozenJourneyArtifact(artifact());
    expect(parsed?.publicTitle).toBe('Kapak başlığı');
    expect(parsed?.experienceType).toBeUndefined();
    expect(parsed?.contentNature).toBeUndefined();
    expect(contentIdentityRequestFields(null)).toEqual({});
  });

  it('parses both labels and drops an invalid value', () => {
    const parsed = parsePublicFrozenJourneyArtifact({
      ...artifact(),
      experienceType: 'story',
      contentNature: 'fiction',
    });
    expect(parsed?.experienceType).toBe('story');
    expect(parsed?.contentNature).toBe('fiction');
    const dropped = parsePublicFrozenJourneyArtifact({
      ...artifact(),
      experienceType: 'official',
      contentNature: 'real',
    });
    expect(dropped?.experienceType).toBeUndefined();
    expect(dropped?.contentNature).toBe('real');
  });

  it('shows publish choices and sends them with the artifact', () => {
    const ready = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage(),
      publicTitle: 'Kapak başlığı',
      publicSummary: 'Kısa özet',
      sceneImageUrl: 'https://cdn.example/scene.jpg',
    });
    expect(ready).not.toBeNull();
    const onPublish = vi.fn();
    render(
      <AynaJourneySlide
        artifact={ready!}
        actions={{
          onPublish,
          onShare: () => undefined,
          onOpenDiscover: () => undefined,
          onOpenAuthorProfile: () => undefined,
          onOpenParent: () => undefined,
        }}
      />
    );
    fireEvent.change(screen.getByTestId('ayna-experience-type'), {
      target: { value: 'story' },
    });
    fireEvent.change(screen.getByTestId('ayna-content-nature'), {
      target: { value: 'fiction' },
    });
    fireEvent.click(screen.getByRole('button', { name: /yayınla/i }));
    expect(onPublish).toHaveBeenCalledWith(ready, {
      experienceType: 'story',
      contentNature: 'fiction',
    });
    expect(contentIdentityRequestFields({ experienceType: 'story', contentNature: 'fiction' })).toEqual({
      experienceType: 'story',
      contentNature: 'fiction',
    });
  });

  it('renders reel labels without replacing the title or claiming verification', () => {
    render(
      <YansiDesktopReelSurface
        node={{
          artifact: artifact({ experienceType: 'knowledge', contentNature: 'real' }),
          authorDisplayName: 'Ada',
          authorHonorific: '',
          authorAvatarUrl: null,
          authorAvatarRevision: null,
          parentAuthorDisplayName: null,
          parentPublicTitle: null,
        }}
        role="current"
      />
    );
    expect(screen.getByTestId('mirror-yansi-active-title')).toHaveTextContent('Kapak başlığı');
    expect(screen.getByTestId('yansi-desktop-public-meta-type')).toHaveTextContent('Yansı');
    const label = screen.getByTestId('yansi-content-identity');
    expect(label).toHaveTextContent('Bilgi');
    expect(label).toHaveTextContent('Gerçek anlatım');
    expect(label).not.toHaveTextContent('Doğrulandı');
    expect(label.getAttribute('data-verified')).toBeNull();
  });

  it('treats a missing label echo as published, not as a failed publish', () => {
    expect(
      classifyContentIdentityEcho(
        { experienceType: 'story', contentNature: 'fiction' },
        { experienceType: null, contentNature: null }
      )
    ).toBe('unconfirmed');
    expect(
      classifyContentIdentityEcho(
        { experienceType: 'story', contentNature: 'fiction' },
        { experienceType: 'story', contentNature: 'fiction' }
      )
    ).toBe('confirmed');
    expect(classifyContentIdentityEcho(undefined, {})).toBe('absent');
    expect(YANSI_IDENTITY_UNCONFIRMED_MESSAGE).not.toMatch(/yazılamadı|yayınlanamadı/i);
    expect(YANSI_IDENTITY_UNCONFIRMED_MESSAGE).toMatch(/yayınlandı/i);
    expect(YANSI_IDENTITY_UNCONFIRMED_MESSAGE).toMatch(/doğrulanamadı/i);
    const publishFlow = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(publishFlow).toContain('classifyContentIdentityEcho');
    expect(publishFlow).not.toContain('İçerik etiketi yayın kaydına yazılamadı.');
    expect(publishFlow).toContain('recoverPublishedJourneyAfterLostResponse');
  });

  it('renders no extra label when metadata is missing', () => {
    render(<YansiContentIdentityLine />);
    expect(screen.queryByTestId('yansi-content-identity')).not.toBeInTheDocument();
  });
});
