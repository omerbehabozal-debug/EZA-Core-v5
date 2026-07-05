'use client';

import '@/styles/saina-mirror.css';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildApiUrl } from '@/lib/apiUrl';
import {
  SAINA_AUTH_EMAIL_LABEL,
  SAINA_AUTH_GOOGLE_UNAVAILABLE,
  SAINA_AUTH_HAS_ACCOUNT,
  SAINA_AUTH_LOGIN_SUBMIT,
  SAINA_AUTH_NAME_LABEL,
  SAINA_AUTH_PASSWORD_LABEL,
  SAINA_AUTH_REGISTER_SUBMIT,
  SAINA_AUTH_REGISTER_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaAuthShell, {
  SainaAuthDivider,
  SainaAuthGoogleButton,
  SainaAuthLink,
} from '@/components/saina/SainaAuthShell';

type SainaRegisterViewProps = {
  returnPath: string | null;
};

export default function SainaRegisterView({ returnPath }: SainaRegisterViewProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loginHref = returnPath
    ? `/platform/login?return=${encodeURIComponent(returnPath)}`
    : '/platform/login';

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

      const loginReturn = returnPath
        ? `/platform/login?return=${encodeURIComponent(returnPath)}&registered=true`
        : '/platform/login?registered=true';
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
      <SainaAuthGoogleButton
        disabled={loading}
        onClick={() => setError(SAINA_AUTH_GOOGLE_UNAVAILABLE)}
      />

      <SainaAuthDivider />

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
