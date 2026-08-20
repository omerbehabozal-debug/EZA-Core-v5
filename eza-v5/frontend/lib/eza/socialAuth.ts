/**
 * Phase 8.7.1 — social auth client (Google GIS + Apple JS → biligN TokenResponse).
 * Provider tokens are never persisted; only biligN JWT goes through setAuth.
 */

import { buildApiUrl } from '@/lib/apiUrl';

export type SocialTokenResponse = {
  access_token: string;
  token_type?: string;
  user_id: string;
  role: string;
  email: string;
};

export type SocialCapabilities = {
  googleEnabled: boolean;
  appleEnabled: boolean;
  googleClientId: string | null;
  appleClientId: string | null;
  appleRedirectUri: string | null;
};

let capabilitiesCache: SocialCapabilities | null = null;

export async function fetchSocialAuthCapabilities(): Promise<SocialCapabilities> {
  if (capabilitiesCache) return capabilitiesCache;
  try {
    const res = await fetch(buildApiUrl('/api/auth/social/capabilities'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        googleEnabled: false,
        appleEnabled: false,
        googleClientId: null,
        appleClientId: null,
        appleRedirectUri: null,
      };
    }
    const data = (await res.json()) as SocialCapabilities;
    capabilitiesCache = {
      googleEnabled: Boolean(data.googleEnabled),
      appleEnabled: Boolean(data.appleEnabled),
      googleClientId: data.googleClientId || null,
      appleClientId: data.appleClientId || null,
      appleRedirectUri: data.appleRedirectUri || null,
    };
    return capabilitiesCache;
  } catch {
    return {
      googleEnabled: false,
      appleEnabled: false,
      googleClientId: null,
      appleClientId: null,
      appleRedirectUri: null,
    };
  }
}

/** Test helper — clear capabilities memo. */
export function clearSocialCapabilitiesCacheForTests(): void {
  capabilitiesCache = null;
}

export async function exchangeGoogleIdToken(
  idToken: string
): Promise<{ ok: true; data: SocialTokenResponse } | { ok: false; message: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/auth/social/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        typeof body?.detail === 'object' && body.detail?.message
          ? String(body.detail.message)
          : typeof body?.detail === 'string'
            ? body.detail
            : 'Google ile giriş başarısız.';
      return { ok: false, message: detail };
    }
    if (!body?.access_token || !body?.user_id) {
      return { ok: false, message: 'Google ile giriş başarısız.' };
    }
    return { ok: true, data: body as SocialTokenResponse };
  } catch {
    return { ok: false, message: 'Bağlantı hatası. Tekrar dene.' };
  }
}

export async function exchangeAppleIdToken(input: {
  idToken: string;
  nonce?: string | null;
  fullName?: string | null;
}): Promise<{ ok: true; data: SocialTokenResponse } | { ok: false; message: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/auth/social/apple'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id_token: input.idToken,
        nonce: input.nonce || undefined,
        full_name: input.fullName || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        typeof body?.detail === 'object' && body.detail?.message
          ? String(body.detail.message)
          : typeof body?.detail === 'string'
            ? body.detail
            : 'Apple ile giriş başarısız.';
      return { ok: false, message: detail };
    }
    if (!body?.access_token || !body?.user_id) {
      return { ok: false, message: 'Apple ile giriş başarısız.' };
    }
    return { ok: true, data: body as SocialTokenResponse };
  } catch {
    return { ok: false, message: 'Bağlantı hatası. Tekrar dene.' };
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code?: string; state?: string };
          user?: { name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no_document'));
      return;
    }
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('script_load_failed'));
    document.head.appendChild(script);
  });
}

export async function requestGoogleIdToken(clientId: string): Promise<string> {
  await loadScript('https://accounts.google.com/gsi/client', 'eza-google-gis');
  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services yüklenemedi.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error, token?: string) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(token!);
    };
    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        const cred = response?.credential?.trim();
        if (!cred) {
          finish(new Error('Google kimliği alınamadı.'));
          return;
        }
        finish(undefined, cred);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        finish(new Error('Google girişi iptal edildi.'));
      }
    });
  });
}

function randomNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `n_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

export async function requestAppleIdToken(
  clientId: string,
  redirectUri?: string | null
): Promise<{
  idToken: string;
  nonce: string;
  fullName: string | null;
}> {
  await loadScript(
    'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    'eza-apple-auth'
  );
  if (!window.AppleID?.auth) {
    throw new Error('Apple Sign In yüklenemedi.');
  }
  const nonce = randomNonce();
  const redirectURI =
    (redirectUri || '').trim() ||
    (typeof window !== 'undefined' ? `${window.location.origin}/platform/login` : '');
  if (!redirectURI) {
    throw new Error('Apple yönlendirme adresi yapılandırılmamış.');
  }
  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    redirectURI,
    usePopup: true,
    nonce,
  });
  const result = await window.AppleID.auth.signIn();
  const idToken = result?.authorization?.id_token?.trim();
  if (!idToken) {
    throw new Error('Apple kimliği alınamadı.');
  }
  const first = result.user?.name?.firstName?.trim() || '';
  const last = result.user?.name?.lastName?.trim() || '';
  const fullName = [first, last].filter(Boolean).join(' ') || null;
  return { idToken, nonce, fullName };
}
