'use client';

import '@/styles/saina-mirror.css';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { buildApiUrl } from '@/lib/apiUrl';
import { buildSainaAuthHref, resolveSafeAuthReturnPath } from '@/lib/eza/sainaIdentity';
import {
  SAINA_AUTH_EMAIL_LABEL,
  SAINA_AUTH_HAS_ACCOUNT,
  SAINA_AUTH_LOGIN_SUBMIT,
  SAINA_AUTH_NAME_LABEL,
  SAINA_AUTH_PASSWORD_LABEL,
  SAINA_AUTH_REGISTER_SUBMIT,
  SAINA_AUTH_REGISTER_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaAuthShell, { SainaAuthLink } from '@/components/saina/SainaAuthShell';
import SainaSocialAuthButtons from '@/components/saina/SainaSocialAuthButtons';

type SainaRegisterViewProps = {
  returnPath: string | null;
};

type RegisterTokenResponse = {
  access_token?: string;
  user_id?: string;
  role?: string;
  email?: string;
};

export default function SainaRegisterView({ returnPath }: SainaRegisterViewProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuth();

  const safeReturn = resolveSafeAuthReturnPath(returnPath);
  const loginHref = buildSainaAuthHref(safeReturn, 'login');

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Geçerli bir e-posta adresi giriniz');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : typeof errorData.message === 'string'
              ? errorData.message
              : 'Registration failed';
        throw new Error(detail);
      }

      const data = (await response.json()) as RegisterTokenResponse;

      // Phase 8.3 — backend already returns JWT; authenticate immediately (no second-login trap).
      // Never persist or replay the password for a silent login.
      if (data.access_token && data.user_id && data.role) {
        setAuth(data.access_token, {
          email: data.email || email.trim().toLowerCase(),
          role: data.role,
          user_id: data.user_id,
          full_name: fullName.trim() || undefined,
        });
        router.push(safeReturn);
        return;
      }

      // Fallback only if token material is absent — preserve return path.
      const loginReturn = `${buildSainaAuthHref(safeReturn, 'login')}&registered=true`;
      router.push(loginReturn);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kayıt başarısız';
      setError(message || 'Kayıt başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SainaAuthShell title={SAINA_AUTH_REGISTER_TITLE}>
      <SainaSocialAuthButtons
        disabled={loading}
        returnPath={safeReturn}
        onSuccess={() => router.push(safeReturn)}
        onError={(message) => setError(message)}
      />

      <form onSubmit={handleRegister}>
        <div className="saina-auth-field">
          <label htmlFor="saina-register-name">{SAINA_AUTH_NAME_LABEL}</label>
          <input
            id="saina-register-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <div className="saina-auth-field">
          <label htmlFor="saina-register-email">{SAINA_AUTH_EMAIL_LABEL}</label>
          <input
            id="saina-register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="saina-auth-field">
          <label htmlFor="saina-register-password">{SAINA_AUTH_PASSWORD_LABEL}</label>
          <input
            id="saina-register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className="saina-auth-field">
          <label htmlFor="saina-register-confirm">{SAINA_AUTH_PASSWORD_LABEL}</label>
          <input
            id="saina-register-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        {error ? <p className="saina-auth-error">{error}</p> : null}

        <button type="submit" className="saina-auth-submit" disabled={loading}>
          {loading ? 'Hesap oluşturuluyor…' : SAINA_AUTH_REGISTER_SUBMIT}
        </button>
      </form>

      <p className="saina-auth-page__footer" style={{ marginTop: '1rem' }}>
        {SAINA_AUTH_HAS_ACCOUNT}{' '}
        <SainaAuthLink href={loginHref}>{SAINA_AUTH_LOGIN_SUBMIT}</SainaAuthLink>
      </p>
    </SainaAuthShell>
  );
}
