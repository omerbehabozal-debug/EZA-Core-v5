'use client';

import '@/styles/saina-mirror.css';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  cancelAppleAuthAttempt,
  exchangeAppleIdToken,
  exchangeGoogleIdToken,
  fetchSocialAuthCapabilities,
  requestAppleIdToken,
  requestGoogleIdToken,
  startAppleAuthAttempt,
  type SocialCapabilities,
} from '@/lib/eza/socialAuth';
import {
  SAINA_AUTH_APPLE_CTA,
  SAINA_AUTH_GOOGLE_CTA,
  SAINA_AUTH_OR_DIVIDER,
} from '@/lib/eza/sainaCopy';
import { SainaAuthDivider } from '@/components/saina/SainaAuthShell';

type Props = {
  onSuccess: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** Optional safeReturn path bound into Apple server attempt. */
  returnPath?: string | null;
};

/**
 * Phase 8.7.1 / 8.7.2 — Google / Apple → biligN setAuth (same continuity as email).
 */
export default function SainaSocialAuthButtons({
  onSuccess,
  onError,
  disabled,
  returnPath,
}: Props) {
  const { setAuth } = useAuth();
  const [caps, setCaps] = useState<SocialCapabilities | null>(null);
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialAuthCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyToken = (data: {
    access_token: string;
    user_id: string;
    role: string;
    email: string;
  }) => {
    setAuth(data.access_token, {
      email: data.email,
      role: data.role,
      user_id: data.user_id,
    });
    onSuccess();
  };

  const runGoogle = async () => {
    if (inFlightRef.current || busy || disabled) return;
    if (!caps?.googleEnabled || !caps.googleClientId) {
      onError('Google ile giriş şu an kullanılamıyor.');
      return;
    }
    inFlightRef.current = true;
    setBusy('google');
    try {
      const idToken = await requestGoogleIdToken(caps.googleClientId);
      const result = await exchangeGoogleIdToken(idToken);
      if (!result.ok) {
        onError(result.message);
        return;
      }
      applyToken(result.data);
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('iptal')
          ? 'Google girişi iptal edildi.'
          : err instanceof Error
            ? err.message
            : 'Google ile giriş başarısız.';
      onError(msg);
    } finally {
      inFlightRef.current = false;
      setBusy(null);
    }
  };

  const runApple = async () => {
    if (inFlightRef.current || busy || disabled) return;
    if (!caps?.appleEnabled || !caps.appleClientId) {
      onError('Apple ile giriş şu an kullanılamıyor.');
      return;
    }
    inFlightRef.current = true;
    setBusy('apple');
    let attemptState: string | null = null;
    try {
      const started = await startAppleAuthAttempt(returnPath);
      if (!started.ok) {
        onError(started.message);
        return;
      }
      attemptState = started.data.state;
      const apple = await requestAppleIdToken(started.data);
      const result = await exchangeAppleIdToken({
        idToken: apple.idToken,
        state: apple.state,
        fullName: apple.fullName,
      });
      if (!result.ok) {
        onError(result.message);
        return;
      }
      applyToken(result.data);
    } catch (err) {
      if (attemptState) {
        void cancelAppleAuthAttempt(attemptState);
      }
      const msg =
        err instanceof Error && /cancel|abort|popup|iptal/i.test(err.message)
          ? 'Apple girişi iptal edildi.'
          : err instanceof Error
            ? err.message
            : 'Apple ile giriş başarısız.';
      onError(msg);
    } finally {
      inFlightRef.current = false;
      setBusy(null);
    }
  };

  const showGoogle = Boolean(caps?.googleEnabled && caps.googleClientId);
  const showApple = Boolean(caps?.appleEnabled && caps.appleClientId);
  if (!caps || (!showGoogle && !showApple)) {
    return null;
  }

  return (
    <div className="saina-social-auth" data-testid="saina-social-auth">
      {showGoogle ? (
        <button
          type="button"
          className="saina-auth-google-btn"
          data-testid="saina-auth-google-btn"
          disabled={disabled || busy !== null}
          aria-busy={busy === 'google'}
          onClick={() => void runGoogle()}
        >
          <span className="saina-auth-google-btn__icon" aria-hidden>
            G
          </span>
          {busy === 'google' ? 'Google…' : SAINA_AUTH_GOOGLE_CTA}
        </button>
      ) : null}
      {showApple ? (
        <button
          type="button"
          className="saina-auth-apple-btn"
          data-testid="saina-auth-apple-btn"
          disabled={disabled || busy !== null}
          aria-busy={busy === 'apple'}
          onClick={() => void runApple()}
        >
          <span className="saina-auth-apple-btn__icon" aria-hidden>
            
          </span>
          {busy === 'apple' ? 'Apple…' : SAINA_AUTH_APPLE_CTA}
        </button>
      ) : null}
      <SainaAuthDivider />
      <p className="sr-only">{SAINA_AUTH_OR_DIVIDER}</p>
    </div>
  );
}
