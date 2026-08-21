/**
 * Phase 8.7.2 — social auth security closure (frontend).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.7.2 social auth security surface', () => {
  it('account_link_required surfaces safe Turkish message', () => {
    const social = read('lib/eza/socialAuth.ts');
    expect(social).toContain('account_link_required');
    expect(social).toContain('SAINA_SOCIAL_ACCOUNT_LINK_REQUIRED');
    expect(social).toContain('mevcut bir biligN hesabı');
  });

  it('conflict path does not clear guest / logout', () => {
    const buttons = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(buttons).not.toContain('logout(');
    expect(buttons).not.toContain('clearAuthStorage');
    expect(buttons).not.toContain('rotateMirrorGuestToken');
  });

  it('Apple start obtains server attempt before provider invocation', () => {
    const buttons = read('components/saina/SainaSocialAuthButtons.tsx');
    const social = read('lib/eza/socialAuth.ts');
    expect(buttons).toContain('startAppleAuthAttempt');
    expect(buttons).toContain('requestAppleIdToken(started.data)');
    expect(social).toContain('/api/auth/social/apple/start');
    expect(social).toContain('state');
    expect(social).toContain('nonce');
  });

  it('Apple provider uses returned state/nonce; callback sends state not client nonce', () => {
    const social = read('lib/eza/socialAuth.ts');
    expect(social).toContain('state: attempt.state');
    expect(social).toContain('nonce: attempt.nonce');
    expect(social).toContain('state: input.state');
    expect(social).not.toMatch(/body:\s*JSON\.stringify\(\{[\s\S]*nonce:\s*input\.nonce/);
  });

  it('cancel discards Apple attempt and clears loading without setAuth', () => {
    const buttons = read('components/saina/SainaSocialAuthButtons.tsx');
    expect(buttons).toContain('cancelAppleAuthAttempt');
    expect(buttons).toContain('Apple girişi iptal edildi');
    expect(buttons).toContain('setBusy(null)');
  });

  it('no provider token stored; Google/Apple success still enter setAuth', () => {
    const buttons = read('components/saina/SainaSocialAuthButtons.tsx');
    const social = read('lib/eza/socialAuth.ts');
    expect(buttons).toContain('setAuth(');
    expect(social).toContain('Provider tokens are never persisted');
    expect(social).not.toContain('localStorage');
    expect(social).not.toContain('sessionStorage');
  });

  it('safeReturn preserved; no profile redirect', () => {
    const login = read('components/saina/SainaLoginView.tsx');
    expect(login).toContain('returnPath={safeReturn}');
    expect(login).toContain('router.push(safeReturn)');
    expect(login).not.toMatch(/router\.push\(['"]\/profile/);
  });

  it('mobile IdentityModal remains usable with social returnPath', () => {
    const modal = read('components/plan/IdentityModal.tsx');
    expect(modal).toContain('SainaSocialAuthButtons');
    expect(modal).toContain('returnPath={returnUrl}');
    expect(modal).toContain('safe-area-inset-bottom');
  });
});

describe('Phase 8.7.2 socialAuth helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('maps account_link_required to safe message without storing tokens', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          detail: {
            code: 'account_link_required',
            message:
              'Bu e-posta ile mevcut bir biligN hesabı var. Önce mevcut hesabınla giriş yap.',
          },
        }),
      })
    );

    const { exchangeGoogleIdToken } = await import('@/lib/eza/socialAuth');
    const result = await exchangeGoogleIdToken('provider-id-token');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('mevcut bir biligN hesabı');
    }
    expect(setItem).not.toHaveBeenCalled();
  });

  it('startAppleAuthAttempt posts return_path and returns state+nonce', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        state: 'server-state',
        nonce: 'server-nonce',
        clientId: 'com.ezacore.web',
        redirectUri: 'https://standalone.ezacore.ai/platform/login',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { startAppleAuthAttempt } = await import('@/lib/eza/socialAuth');
    const result = await startAppleAuthAttempt('/m/abc/sohbet');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state).toBe('server-state');
      expect(result.data.nonce).toBe('server-nonce');
    }
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.return_path).toBe('/m/abc/sohbet');
  });
});
