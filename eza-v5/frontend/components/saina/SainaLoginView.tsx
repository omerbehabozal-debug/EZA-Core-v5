'use client';

import '@/styles/saina-mirror.css';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { buildApiUrl } from '@/lib/apiUrl';
import {
  SAINA_AUTH_EMAIL_LABEL,
  SAINA_AUTH_GOOGLE_UNAVAILABLE,
  SAINA_AUTH_HAS_ACCOUNT,
  SAINA_AUTH_LOGIN_SUBMIT,
  SAINA_AUTH_LOGIN_TITLE,
  SAINA_AUTH_NO_ACCOUNT,
  SAINA_AUTH_PASSWORD_LABEL,
  SAINA_AUTH_REGISTER_SUBMIT,
} from '@/lib/eza/sainaCopy';
import SainaAuthShell, {
  SainaAuthDivider,
  SainaAuthGoogleButton,
  SainaAuthLink,
} from '@/components/saina/SainaAuthShell';

type SainaLoginViewProps = {
  returnPath: string | null;
  showRegisteredMessage?: boolean;
};

export default function SainaLoginView({
  returnPath,
  showRegisteredMessage = false,
}: SainaLoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuth();

  const registerHref = returnPath
    ? `/platform/register?return=${encodeURIComponent(returnPath)}`
    : '/platform/register';

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 502 || response.status === 503) {
          throw new Error('SERVER_UNAVAILABLE');
        }
        const detail =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : typeof errorData.message === 'string'
              ? errorData.message
              : 'Login failed';
        throw new Error(detail);
      }

      const data = await response.json();
      if (!data.access_token || !data.role) {
        throw new Error('Invalid response from server');
      }

      setAuth(data.access_token, {
        email: data.email,
        role: data.role,
        user_id: data.user_id,
      });

      router.push(returnPath && returnPath.startsWith('/') ? returnPath : '/standalone');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız';
      if (message === 'SERVER_UNAVAILABLE') {
        setError('Sunucu şu anda yanıt vermiyor. Lütfen birkaç dakika sonra tekrar deneyin.');
      } else if (message.includes('401') || message.includes('Incorrect')) {
        setError('Geçersiz e-posta veya şifre.');
      } else if (message.includes('Network') || message.includes('fetch') || message.includes('Failed to fetch')) {
        setError('Ağ hatası. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      } else {
        setError(message || 'Giriş başarısız. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SainaAuthShell title={SAINA_AUTH_LOGIN_TITLE}>
      {showRegisteredMessage ? (
        <p className="saina-auth-error" style={{ borderColor: 'rgba(231,180,91,0.22)', background: 'rgba(231,180,91,0.08)', color: 'rgba(246,244,239,0.88)' }}>
          Hesabın hazır. Giriş yapabilirsin.
        </p>
      ) : null}

      <SainaAuthGoogleButton
        disabled={loading}
        onClick={() => setError(SAINA_AUTH_GOOGLE_UNAVAILABLE)}
      />

      <SainaAuthDivider />

      <form onSubmit={handleLogin}>
        <div className="saina-auth-field">
          <label htmlFor="saina-login-email">{SAINA_AUTH_EMAIL_LABEL}</label>
          <input
            id="saina-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="saina-auth-field">
          <label htmlFor="saina-login-password">{SAINA_AUTH_PASSWORD_LABEL}</label>
          <input
            id="saina-login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        {error ? <p className="saina-auth-error">{error}</p> : null}

        <button type="submit" className="saina-auth-submit" disabled={loading}>
          {loading ? 'Giriş yapılıyor…' : SAINA_AUTH_LOGIN_SUBMIT}
        </button>
      </form>

      <p className="saina-auth-page__footer" style={{ marginTop: '1rem' }}>
        {SAINA_AUTH_NO_ACCOUNT}{' '}
        <SainaAuthLink href={registerHref}>{SAINA_AUTH_REGISTER_SUBMIT}</SainaAuthLink>
      </p>
    </SainaAuthShell>
  );
}
