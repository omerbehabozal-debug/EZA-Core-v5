/**
 * Ayna generation must leave terminal states — never infinite Hazırlanıyor.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllMirrorJourneyArtifactsForTests,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactFailed,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  consumePendingJourneyAynaGeneration,
  readPendingJourneyAynaGeneration,
  requestJourneyAynaGeneration,
  JOURNEY_AYNA_GENERATE_PENDING_KEY,
} from '@/lib/eza/mirror/journey/journeyAynaGenerate';
import { clearAllReview8Drafts } from '@/lib/eza/mirror/journey/review8DraftStore';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Ayna generation lifecycle — no infinite Hazırlanıyor', () => {
  const obs = read('components/standalone/StandaloneObservationExperience.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const sheet = read('components/saina/SainaMobileAynaSheet.tsx');

  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    clearAllReview8Drafts();
    try {
      sessionStorage.removeItem(JOURNEY_AYNA_GENERATE_PENDING_KEY);
    } catch {
      // ignore
    }
  });

  it('mobile Ayna pill only opens sheet via tryOpenMirror (generation is Review kick)', () => {
    expect(shell).toMatch(/saina-mobile-ayna-pill[\s\S]*onClick=\{tryOpenMirror\}/);
    expect(shell).toMatch(/setMirrorCollapsed\(false\)/);
    expect(sheet).toContain('SainaStandaloneMirrorPanel');
    expect(shell).not.toMatch(
      /saina-mobile-ayna-pill[\s\S]*requestJourneyAynaGeneration/
    );
  });

  it('captures pending journey id before consume so scene errors can markFailed', () => {
    expect(obs).toContain('pendingKickAtStart');
    expect(obs).toContain('kickFailJourneyId');
    expect(obs).toMatch(
      /consumePendingJourneyAynaGeneration\(conversationId\);[\s\S]*setSceneImageStatus\('generating'\)/
    );
    expect(obs).toMatch(
      /failJourneyId[\s\S]*kickFailJourneyId[\s\S]*markMirrorJourneyArtifactFailed/
    );
  });

  it('quota/visual block on kick fails the generating artifact (not endless loading)', () => {
    expect(obs).toMatch(
      /if \(!canCreateVisual\) \{[\s\S]*failKickArtifact\([\s\S]*visual_not_available/
    );
    expect(obs).toContain('markMirrorJourneyArtifactFailed');
  });

  it('Review kick authorizes reveal synchronously and only latches kickKey on start', () => {
    expect(obs).toContain('authorizeJourneyReveal: true');
    expect(obs).toMatch(
      /journeyAuthorizedReveal:\s*options\?\.authorizeJourneyReveal === true \|\| journeyAuthorizedReveal/
    );
    expect(obs).toMatch(
      /const started = runMirrorWithReveal\([\s\S]*authorizeJourneyReveal:\s*true/
    );
    expect(obs).toMatch(/if \(started\) \{[\s\S]*journeyAynaKickKeyRef\.current = kickKey/);
  });

  it('remount re-arms kick when generating artifact has no pending', () => {
    expect(obs).toMatch(
      /stuckGenerating[\s\S]*loadReview8DraftForJourney[\s\S]*requestJourneyAynaGeneration[\s\S]*kickJourneyAynaGenerate\(rearmed\)/
    );
  });

  it('store: markFailed clears generating toward terminal failed', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-stuck',
      journeyVersion: 1,
      sourceConversationId: 'chat-1',
      blockIndex: 0,
      selectedCount: 6,
      authorUserId: 'user-1',
      authorDisplayName: 'Tarık',
    });
    expect(loadMirrorJourneyArtifact('user-1', 'journey-stuck', 1)?.status).toBe(
      'generating'
    );
    markMirrorJourneyArtifactFailed('user-1', {
      journeyId: 'journey-stuck',
      journeyVersion: 1,
      message: 'generation_failed',
    });
    expect(loadMirrorJourneyArtifact('user-1', 'journey-stuck', 1)?.status).toBe(
      'failed'
    );
  });

  it('pending kick survives request and is consumable once', () => {
    requestJourneyAynaGeneration({
      conversationId: 'chat-1',
      journeyId: 'journey-stuck',
      journeyVersion: 1,
    });
    expect(readPendingJourneyAynaGeneration('chat-1')?.journeyId).toBe(
      'journey-stuck'
    );
    expect(consumePendingJourneyAynaGeneration('chat-1')?.journeyId).toBe(
      'journey-stuck'
    );
    expect(readPendingJourneyAynaGeneration('chat-1')).toBeNull();
  });
});
