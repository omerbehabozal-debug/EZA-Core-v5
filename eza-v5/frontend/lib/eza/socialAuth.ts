/**
 * Phase 8.7.1 / 8.7.2 — social auth client (Google GIS + Apple JS → biligN TokenResponse).
 * Provider tokens are never persisted; only biligN JWT goes through setAuth.
 * Apple state/nonce come from server /api/auth/social/apple/start (Phase 8.7.2).
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

export type AppleAuthAttempt = {
  state: string;
  nonce: string;
  clientId: string;
  redirectUri: string;
};

export const SAINA_SOCIAL_ACCOUNT_LINK_REQUIRED =
  'Bu e-posta ile mevcut bir biligN hesabı var. Önce mevcut hesabınla giriş yap.';

let capabilitiesCache: SocialCapabilities | null = null;

function socialErrorMessage(body: unknown, fallback: string): string {
  const detail =
    body && typeof body === 'object' && 'detail' in body
      ? (body as { detail?: unknown }).detail
      : undefined;
  if (detail && typeof detail === 'object' && detail !== null) {
    const code = (detail as { code?: unknown }).code;
    const message = (detail as { message?: unknown }).message;
    if (code === 'account_link_required') {
      return typeof message === 'string' && message.trim()
        ? message
        : SAINA_SOCIAL_ACCOUNT_LINK_REQUIRED;
    }
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  return fallback;
}

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
      return { ok: false, message: socialErrorMessage(body, 'Google ile giriş başarısız.') };
    }
    if (!body?.access_token || !body?.user_id) {
      return { ok: false, message: 'Google ile giriş başarısız.' };
    }
    return { ok: true, data: body as SocialTokenResponse };
  } catch {
    return { ok: false, message: 'Bağlantı hatası. Tekrar dene.' };
  }
}

export async function startAppleAuthAttempt(
  returnPath?: string | null
): Promise<{ ok: true; data: AppleAuthAttempt } | { ok: false; message: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/auth/social/apple/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        return_path: returnPath || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: socialErrorMessage(body, 'Apple ile giriş başlatılamadı.') };
    }
    if (!body?.state || !body?.nonce || !body?.clientId || !body?.redirectUri) {
      return { ok: false, message: 'Apple ile giriş başlatılamadı.' };
    }
    return {
      ok: true,
      data: {
        state: String(body.state),
        nonce: String(body.nonce),
        clientId: String(body.clientId),
        redirectUri: String(body.redirectUri),
      },
    };
  } catch {
    return { ok: false, message: 'Bağlantı hatası. Tekrar dene.' };
  }
}

export async function cancelAppleAuthAttempt(state: string): Promise<void> {
  try {
    await fetch(buildApiUrl('/api/auth/social/apple/cancel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ state }),
    });
  } catch {
    // Best-effort discard; guest state remains either way.
  }
}

export async function exchangeAppleIdToken(input: {
  idToken: string;
  state: string;
  fullName?: string | null;
}): Promise<{ ok: true; data: SocialTokenResponse } | { ok: false; message: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/auth/social/apple'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id_token: input.idToken,
        state: input.state,
        full_name: input.fullName || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: socialErrorMessage(body, 'Apple ile giriş başarısız.') };
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

export async function requestAppleIdToken(attempt: AppleAuthAttempt): Promise<{
  idToken: string;
  state: string;
  fullName: string | null;
}> {
  await loadScript(
    'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    'eza-apple-auth'
  );
  if (!window.AppleID?.auth) {
    throw new Error('Apple Sign In yüklenemedi.');
  }
  window.AppleID.auth.init({
    clientId: attempt.clientId,
    scope: 'name email',
    redirectURI: attempt.redirectUri,
    usePopup: true,
    state: attempt.state,
    nonce: attempt.nonce,
  });
  const result = await window.AppleID.auth.signIn();
  const idToken = result?.authorization?.id_token?.trim();
  if (!idToken) {
    throw new Error('Apple kimliği alınamadı.');
  }
  const returnedState = result?.authorization?.state?.trim();
  if (returnedState && returnedState !== attempt.state) {
    throw new Error('Apple oturumu doğrulanamadı.');
  }
  const first = result.user?.name?.firstName?.trim() || '';
  const last = result.user?.name?.lastName?.trim() || '';
  const fullName = [first, last].filter(Boolean).join(' ') || null;
  return { idToken, state: attempt.state, fullName };
}
