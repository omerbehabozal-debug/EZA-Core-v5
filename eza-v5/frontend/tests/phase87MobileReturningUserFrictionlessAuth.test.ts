/**
 * Phase 8.7 — mobile, returning user & frictionless auth closure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveSafeAuthReturnPath,
  buildSainaAuthHref,
  isSainaAuthReturnPath,
} from '@/lib/eza/sainaIdentity';
import {
  clearAllMirrorJourneyArtifactsForTests,
  guestJourneyOwnerKey,
  markMirrorJourneyArtifactGenerating,
  migrateGuestJourneyStateToUser,
  resolveJourneyOwnerKey,
  loadMirrorJourneyArtifact,
  saveJourneyConversationState,
  loadJourneyConversationState,
  createEmptyJourneyConversationState,
} from '@/lib/eza/mirror/journey';
import {
  getOrCreateDiscoverRandomSession,
  readDiscoverScrollPosition,
  saveDiscoverScrollPosition,
  DISCOVER_RANDOM_SESSION_STORAGE_KEY,
} from '@/lib/eza/mirror-network/discoverModes';
import { getOrCreateMirrorGuestToken, clearMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';

describe('Phase 8.7 frictionless auth + mobile continuity', () => {
  beforeEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    clearMirrorGuestToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('safe return URL rejects external / scheme / unknown paths', () => {
    expect(resolveSafeAuthReturnPath('https://evil.example')).toBe(
      '/standalone/discover'
    );
    expect(resolveSafeAuthReturnPath('//evil.example')).toBe('/standalone/discover');
    expect(resolveSafeAuthReturnPath('/\\evil')).toBe('/standalone/discover');
    expect(resolveSafeAuthReturnPath('/admin/secret')).toBe('/standalone/discover');
    expect(resolveSafeAuthReturnPath('/m/slug-a/sohbet')).toBe('/m/slug-a/sohbet');
    expect(resolveSafeAuthReturnPath('/standalone?chat=abc')).toBe(
      '/standalone?chat=abc'
    );
  });

  it('register/login hrefs preserve return and never target profile', () => {
    const href = buildSainaAuthHref('/m/demo/sohbet', 'register');
    expect(href).toContain('return=');
    expect(decodeURIComponent(href.split('return=')[1]!)).toContain('/m/demo/sohbet');
    expect(isSainaAuthReturnPath('/standalone/u/user-1')).toBe(true);
    const login = readFileSync(
      join(process.cwd(), 'components/saina/SainaLoginView.tsx'),
      'utf8'
    );
    const register = readFileSync(
      join(process.cwd(), 'components/saina/SainaRegisterView.tsx'),
      'utf8'
    );
    expect(login).toContain('router.push(safeReturn)');
    expect(register).toContain('router.push(safeReturn)');
    expect(login).not.toContain('/standalone/u/');
    expect(register).not.toContain('/standalone/u/');
    expect(register).not.toContain('Profili düzenle');
  });

  it('no mandatory profile setup after auth', () => {
    const register = readFileSync(
      join(process.cwd(), 'components/saina/SainaRegisterView.tsx'),
      'utf8'
    );
    expect(register).not.toMatch(/interest|avatar upload|bio|onboarding wizard/i);
    const identity = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/publicIdentity.ts'),
      'utf8'
    );
    expect(identity).toContain('PUBLIC_DISPLAY_NAME_FALLBACK');
  });

  it('Google/Apple social buttons wired via SainaSocialAuthButtons (Phase 8.7.1)', () => {
    const login = readFileSync(
      join(process.cwd(), 'components/saina/SainaLoginView.tsx'),
      'utf8'
    );
    expect(login).toContain('SainaSocialAuthButtons');
    const social = readFileSync(
      join(process.cwd(), 'components/saina/SainaSocialAuthButtons.tsx'),
      'utf8'
    );
    expect(social).toContain('Apple');
    expect(social).toContain('Google');
  });

  it('guest Journey owner key and migrate rebinds unpublished Ayna', () => {
    const token = getOrCreateMirrorGuestToken();
    const guestOwner = guestJourneyOwnerKey(token);
    expect(guestOwner.startsWith('guest:')).toBe(true);
    expect(resolveJourneyOwnerKey(null)).toBe(guestOwner);

    const convId = 'chat-guest-1';
    const empty = createEmptyJourneyConversationState({
      ownerUserId: guestOwner,
      sourceConversationId: convId,
    });
    saveJourneyConversationState({ ...empty, stateVersion: 0 });
    markMirrorJourneyArtifactGenerating(guestOwner, {
      journeyId: 'guest-journey-a',
      sourceConversationId: convId,
      blockIndex: 0,
      selectedCount: 8,
    });
    expect(
      loadMirrorJourneyArtifact(guestOwner, 'guest-journey-a', 1)?.status
    ).toBe('generating');

    const result = migrateGuestJourneyStateToUser({
      guestToken: token,
      userId: 'user-auth-1',
    });
    expect(result.migrated).toBe(true);
    expect(loadJourneyConversationState('user-auth-1', convId)).toBeTruthy();
    expect(
      loadMirrorJourneyArtifact('user-auth-1', 'guest-journey-a', 1)?.status
    ).toBe('generating');
    // Idempotent
    const again = migrateGuestJourneyStateToUser({
      guestToken: token,
      userId: 'user-auth-1',
    });
    expect(again.panelArtifacts).toBe(0);
  });

  it('another user cannot claim guest Journey via foreign userId alone', () => {
    const token = getOrCreateMirrorGuestToken();
    const guestOwner = guestJourneyOwnerKey(token);
    markMirrorJourneyArtifactGenerating(guestOwner, {
      journeyId: 'secret-j',
      sourceConversationId: 'c1',
      blockIndex: 0,
    });
    migrateGuestJourneyStateToUser({ guestToken: token, userId: 'user-a' });
    expect(loadMirrorJourneyArtifact('user-b', 'secret-j', 1)).toBeNull();
    expect(loadMirrorJourneyArtifact('user-a', 'secret-j', 1)?.status).toBe(
      'generating'
    );
  });

  it('Discover randomSession + scroll restore helpers', () => {
    const a = getOrCreateDiscoverRandomSession();
    const b = getOrCreateDiscoverRandomSession();
    expect(a).toBe(b);
    expect(sessionStorage.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY)).toBe(a);
    saveDiscoverScrollPosition('random', 420);
    expect(readDiscoverScrollPosition('random')).toBe(420);
    expect(readDiscoverScrollPosition('newest')).toBeNull();
  });

  it('mobile keyboard inset hook and IdentityModal safe-area exist', () => {
    const hook = readFileSync(
      join(process.cwd(), 'hooks/useSainaVisualViewportInset.ts'),
      'utf8'
    );
    expect(hook).toContain('visualViewport');
    expect(hook).toContain('--saina-keyboard-inset');
    const layout = readFileSync(
      join(process.cwd(), 'app/standalone/SainaAppRootLayout.tsx'),
      'utf8'
    );
    expect(layout).toContain('useSainaVisualViewportInset');
    const modal = readFileSync(
      join(process.cwd(), 'components/plan/IdentityModal.tsx'),
      'utf8'
    );
    expect(modal).toContain('safe-area-inset-bottom');
    expect(modal).toContain('92dvh');
  });

  it('platform login preserves return when linking to register', () => {
    const loginPage = readFileSync(
      join(process.cwd(), 'app/platform/login/page.tsx'),
      'utf8'
    );
    expect(loginPage).toContain('buildSainaAuthHref');
    expect(loginPage).toContain("register'");
  });

  it('guest merge calls Journey migrate; Phase 8.5/8.6 contracts untouched', () => {
    const merge = readFileSync(
      join(process.cwd(), 'lib/eza/conversation-tree/mergeGuestConversationTree.ts'),
      'utf8'
    );
    expect(merge).toContain('migrateGuestJourneyStateToUser');
    const chat = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(chat).toContain('resolveJourneyOwnerKey');
    const obs = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(obs).toContain('!isAuthenticated');
    expect(obs).toContain('setIdentityOpen(true)');
  });

  it('Phase 6/7/8.4 isolation markers', () => {
    const discover = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/discoverModes.ts'),
      'utf8'
    );
    expect(discover).toContain('strong_curiosity');
    expect(discover).toContain('saveDiscoverScrollPosition');
    const trust = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/yansiTrustActions.ts'),
      'utf8'
    );
    expect(trust).toContain('unpublishYansi');
  });
});
