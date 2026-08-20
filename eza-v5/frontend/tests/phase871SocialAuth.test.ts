/**
 * Phase 8.7.1 — Google + Apple social auth into existing setAuth / continuity pipeline.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.7.1 social auth surface', () => {
  it('Google and Apple buttons exist on login/register/IdentityModal', () => {
    const login = read('components/saina/SainaLoginView.tsx');
    const register = read('components/saina/SainaRegisterView.tsx');
    const modal = read('components/plan/IdentityModal.tsx');
    const social = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(login).toContain('SainaSocialAuthButtons');
    expect(register).toContain('SainaSocialAuthButtons');
    expect(modal).toContain('SainaSocialAuthButtons');
    expect(social).toContain('saina-auth-google-btn');
    expect(social).toContain('saina-auth-apple-btn');
    expect(social).toContain('SAINA_AUTH_GOOGLE_CTA');
    expect(social).toContain('SAINA_AUTH_APPLE_CTA');
  });

  it('email path remains on login and register', () => {
    const login = read('components/saina/SainaLoginView.tsx');
    const register = read('components/saina/SainaRegisterView.tsx');
    expect(login).toContain('/api/auth/login');
    expect(register).toMatch(/\/api\/auth\/register/);
    expect(login).toContain('SAINA_AUTH_EMAIL_LABEL');
    expect(register).toContain('SAINA_AUTH_PASSWORD_LABEL');
  });

  it('Google and Apple success enter setAuth pipeline', () => {
    const social = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(social).toContain('setAuth(');
    expect(social).toContain('exchangeGoogleIdToken');
    expect(social).toContain('exchangeAppleIdToken');
    expect(social).toContain('onSuccess()');
    expect(social).not.toContain('localStorage.setItem');
    expect(social).not.toContain('sessionStorage.setItem');
  });

  it('safeReturn preserved; no profile redirect after social auth', () => {
    const login = read('components/saina/SainaLoginView.tsx');
    const register = read('components/saina/SainaRegisterView.tsx');
    expect(login).toContain('resolveSafeAuthReturnPath');
    expect(login).toContain('router.push(safeReturn)');
    expect(register).toContain('router.push(safeReturn)');
    expect(login).not.toMatch(/router\.push\(['"]\/profile/);
    expect(register).not.toMatch(/router\.push\(['"]\/profile/);
    expect(login).not.toMatch(/onboarding|profile setup|wizard/i);
  });

  it('guest Journey migration remains on setAuth via mergeGuestConversationTree', () => {
    const auth = read('context/AuthContext.tsx');
    const merge = read('lib/eza/conversation-tree/mergeGuestConversationTree.ts');
    expect(auth).toContain('bindGuestConversationTree');
    expect(auth).toContain('mergeGuestConversationTree');
    expect(merge).toContain('migrateGuestJourneyStateToUser');
  });

  it('cancellation / error leaves guest path intact (no logout)', () => {
    const social = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(social).toContain('iptal');
    expect(social).not.toContain('logout(');
    expect(social).not.toContain('clearAuthStorage');
    expect(social).not.toContain('rotateMirrorGuestToken');
  });

  it('loading / double-click guarded', () => {
    const social = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(social).toContain('inFlightRef');
    expect(social).toContain('busy');
    expect(social).toContain('disabled={disabled || busy !== null}');
  });

  it('mobile IdentityModal keeps safe-area and ≥44px social targets', () => {
    const modal = read('components/plan/IdentityModal.tsx');
    const css = read('styles/saina-mirror.css');
    expect(modal).toContain('safe-area-inset-bottom');
    expect(modal).toContain('92dvh');
    expect(css).toMatch(/\.saina-auth-google-btn[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/\.saina-auth-apple-btn[\s\S]*min-height:\s*44px/);
  });

  it('provider tokens are never written to biligN auth storage helpers', () => {
    const socialLib = read('lib/eza/socialAuth.ts');
    const auth = read('context/AuthContext.tsx');
    expect(socialLib).toContain('Provider tokens are never persisted');
    expect(socialLib).not.toContain('localStorage');
    expect(socialLib).not.toContain('sessionStorage');
    expect(auth).toContain('function persistAuth');
    expect(auth).not.toContain('id_token');
    expect(auth).not.toContain('provider_subject');
  });

  it('browser reopen uses biligN hydrate /me not provider token', () => {
    const auth = read('context/AuthContext.tsx');
    expect(auth).toContain('/api/auth/me');
    expect(auth).toContain('hydrate');
    expect(auth).not.toContain('accounts.google.com');
    expect(auth).not.toContain('AppleID');
  });

  it('social client exchanges only id_token to backend', () => {
    const socialLib = read('lib/eza/socialAuth.ts');
    expect(socialLib).toContain('/api/auth/social/google');
    expect(socialLib).toContain('/api/auth/social/apple');
    expect(socialLib).toContain('/api/auth/social/capabilities');
    expect(socialLib).toContain('id_token');
    expect(socialLib).not.toContain('drive');
    expect(socialLib).not.toContain('gmail');
  });
});

describe('Phase 8.7.1 socialAuth helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('exchangeGoogleIdToken does not store credential', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'bilign-jwt',
          user_id: 'u1',
          role: 'user',
          email: 'a@b.com',
        }),
      })
    );

    const { exchangeGoogleIdToken, clearSocialCapabilitiesCacheForTests } = await import(
      '@/lib/eza/socialAuth'
    );
    clearSocialCapabilitiesCacheForTests();
    const result = await exchangeGoogleIdToken('provider-id-token-secret');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.access_token).toBe('bilign-jwt');
    }
    expect(setItem).not.toHaveBeenCalled();
  });
});
