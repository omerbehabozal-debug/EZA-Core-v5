import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AynaJourneySlide from '@/components/mirror/ayna/AynaJourneySlide';
import type { JourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  clearAllMirrorJourneyArtifactsForTests,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactPublished,
  markMirrorJourneyArtifactPublishFailed,
  markMirrorJourneyArtifactReadyFromLineage,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { userFacingPublishMessage } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OWNER = 'user-publish-ux';
const SCENE = 'https://api.ezacore.ai/api/public/mirror-scene-assets/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png';

function lineage(): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: 'journey-ux',
    journeyVersion: 1,
    sourceConversationId: 'conv-ux',
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: 'win',
    sourceBlockHash: 'block',
    scopedInputHash: 'scope',
    selectedStepsHash: 'steps',
    interpretationHash: 'interp',
    publicLandingHash: 'land',
    mappedPromptHash: 'map',
    generationId: 'gen-ux',
    sceneAssetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    sealedAt: '2026-09-27T00:00:00.000Z',
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: i,
      sourceUserMessageId: `u-${i}`,
      sourceAssistantMessageId: `a-${i}`,
      publicQuestion: `Soru ${i}`,
      publicAnswer: `Yanıt ${i}`,
    })),
  };
}

function actions() {
  return {
    onPublish: vi.fn(),
    onShare: vi.fn(),
    onOpenDiscover: vi.fn(),
    onOpenAuthorProfile: vi.fn(),
    onOpenParent: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  clearAllMirrorJourneyArtifactsForTests();
});

describe('Ayna publish error UX', () => {
  it('maps lineage/proof failures to a user-safe message and does not claim Yayında', () => {
    const message = userFacingPublishMessage(
      'journey_publish_lineage_mismatch',
      'generation_mismatch',
      'Unknown or expired generationId'
    );
    expect(message).toContain('Yansı yayın kimliği doğrulanamadı');
    expect(message).not.toContain('Traceback');

    markMirrorJourneyArtifactReadyFromLineage(OWNER, {
      lineage: lineage(),
      sceneImageUrl: SCENE,
      publicTitle: 'Başlık',
      publicSummary: 'Özet',
    });
    const failed = markMirrorJourneyArtifactPublishFailed(OWNER, {
      journeyId: 'journey-ux',
      journeyVersion: 1,
      message,
    });
    expect(failed?.status).toBe('ready');
    expect(failed?.sceneImageUrl).toBe(SCENE);

    const { rerender } = render(
      <AynaJourneySlide
        artifact={failed!}
        actions={actions()}
        publishBusy
        publishError={null}
      />
    );
    expect(screen.getByTestId('mirror-publish-btn')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('mirror-publish-live-status')).toBeNull();

    rerender(
      <AynaJourneySlide
        artifact={loadMirrorJourneyArtifact(OWNER, 'journey-ux', 1)!}
        actions={actions()}
        publishBusy={false}
        publishError={message}
      />
    );
    expect(screen.getByTestId('mirror-publish-error')).toHaveTextContent(message);
    expect(screen.getByTestId('ayna-slide-status')).toHaveTextContent('Yayına hazır');
    expect(screen.queryByTestId('mirror-publish-live-status')).toBeNull();
    expect(screen.queryByText('✓ Yayında')).toBeNull();
  });

  it('marks the artifact published only after an exact successful slug', () => {
    const ready = markMirrorJourneyArtifactReadyFromLineage(OWNER, {
      lineage: lineage(),
      sceneImageUrl: SCENE,
      publicTitle: 'Başlık',
      publicSummary: 'Özet',
    })!;
    const published = markMirrorJourneyArtifactPublished(OWNER, {
      journeyId: 'journey-ux',
      journeyVersion: 1,
      slug: 'exact-slug',
      shareUrl: 'https://standalone.ezacore.ai/m/exact-slug',
      sceneImageUrl: SCENE,
    });
    expect(published?.status).toBe('published');
    expect(published?.publish.slug).toBe('exact-slug');
    expect(published?.sceneImageUrl).toBe(SCENE);

    render(
      <AynaJourneySlide artifact={published!} actions={actions()} publishBusy={false} />
    );
    expect(screen.getByTestId('mirror-publish-live-status')).toHaveTextContent('Yayında');
    expect(screen.queryByTestId('mirror-publish-error')).toBeNull();
    expect(ready.status).toBe('ready');
  });

  it('does not regenerate a sealed READY visual during publish', () => {
    const publishSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-share/publishMirrorToNetwork.ts'),
      'utf8'
    );
    const experience = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(publishSrc).toMatch(/regenerateScene:\s*sealedReadyScene\s*\?\s*undefined/);
    expect(experience).toMatch(/regenerateScene:\s*exactPublishIdentity\s*\?\s*undefined/);
    expect(experience).toContain('publishError={shareLinkError}');

    const ready = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage(),
      sceneImageUrl: SCENE,
      publicTitle: 'Başlık',
      publicSummary: 'Özet',
    })!;
    expect(ready.status).toBe('ready');
    expect(ready.sceneImageUrl).toBe(SCENE);
  });
});
