import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearMirrorGuestToken,
  getOrCreateMirrorGuestToken,
  peekMirrorGuestToken,
  rotateMirrorGuestToken,
} from '@/lib/eza/mirror-network/guestToken';
import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';
import { migrateGuestEzaPrefsToUser } from '@/lib/eza/conversation-tree/migrateGuestEzaPrefs';
import {
  EZA_USER_PREFS_STORAGE_KEY,
  getEzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
import { resolveSafeAuthReturnPath } from '@/lib/eza/sainaIdentity';

describe('Phase 8.3 guest token lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and peeks guest token without minting twice', () => {
    const a = getOrCreateMirrorGuestToken();
    const b = peekMirrorGuestToken();
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(b).toBe(a);
  });

  it('rotates guest token after claim/logout boundary', () => {
    const first = getOrCreateMirrorGuestToken();
    const second = rotateMirrorGuestToken();
    expect(second).not.toBe(first);
    expect(localStorage.getItem(MIRROR_GUEST_TOKEN_KEY)).toBe(second);
  });

  it('clear removes guest token', () => {
    getOrCreateMirrorGuestToken();
    clearMirrorGuestToken();
    expect(peekMirrorGuestToken()).toBeNull();
  });
});

describe('Phase 8.3 guest EZA prefs migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('copies guest prefs into user scope without overwriting existing user prefs', () => {
    localStorage.setItem(
      EZA_USER_PREFS_STORAGE_KEY,
      JSON.stringify({
        guest: { ezaVisibilityEnabled: false, ezaDataProcessingEnabled: false },
      })
    );
    expect(migrateGuestEzaPrefsToUser('user-1')).toBe(true);
    expect(getEzaUserPreferences('user-1')).toEqual({
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    });

    localStorage.setItem(
      EZA_USER_PREFS_STORAGE_KEY,
      JSON.stringify({
        guest: { ezaVisibilityEnabled: true, ezaDataProcessingEnabled: true },
        'user-1': { ezaVisibilityEnabled: false, ezaDataProcessingEnabled: false },
      })
    );
    expect(migrateGuestEzaPrefsToUser('user-1')).toBe(false);
    expect(getEzaUserPreferences('user-1').ezaVisibilityEnabled).toBe(false);
  });
});

describe('Phase 8.3 register auth continuity (source contract)', () => {
  it('SainaRegisterView calls setAuth and does not password-replay login', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/saina/SainaRegisterView.tsx'),
      'utf8'
    );
    expect(src).toContain('setAuth');
    expect(src).toContain('access_token');
    expect(src).toContain('router.push(safeReturn)');
    expect(src).not.toContain('/api/auth/login');
    expect(src).not.toContain('password replay');
  });

  it('AuthContext rotates guest token on logout', () => {
    const src = readFileSync(join(process.cwd(), 'context/AuthContext.tsx'), 'utf8');
    expect(src).toContain('rotateMirrorGuestToken');
    expect(src).toContain('peekMirrorGuestToken');
  });

  it('rejects unsafe auth return URLs', () => {
    expect(resolveSafeAuthReturnPath('https://evil.example/phish')).toBe(
      '/standalone/discover'
    );
    expect(resolveSafeAuthReturnPath('/\\evil')).toBe('/standalone/discover');
    expect(resolveSafeAuthReturnPath('/m/slug-a/sohbet')).toBe('/m/slug-a/sohbet');
  });
});
