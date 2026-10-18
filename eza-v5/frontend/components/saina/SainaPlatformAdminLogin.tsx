'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import SainaLoginView from '@/components/saina/SainaLoginView';
import {
  SAINA_BUSINESS_ROUTE,
  SAINA_PLATFORM_ADMIN_ROUTE,
} from '@/lib/eza/sainaRoutes';

/**
 * Dedicated BiligN Platform Yönetimi sign-in.
 * Uses the same /api/auth/login stack; capability is enforced on /standalone/admin.
 */
export default function SainaPlatformAdminLogin() {
  const router = useRouter();
  const { isAuthReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;
    if (isAuthenticated) {
      // Existing session: do not re-prompt; admin page enforces capability.
      router.replace(SAINA_PLATFORM_ADMIN_ROUTE);
    }
  }, [isAuthReady, isAuthenticated, router]);

  if (!isAuthReady) {
    return (
      <main className="biz-panel padmin-panel">
        <div className="padmin-shell-loading">
          <p className="padmin-page-lead">Oturum kontrol ediliyor…</p>
        </div>
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <main className="biz-panel padmin-panel">
        <div className="padmin-shell-loading">
          <p className="padmin-page-lead">Platform Yönetimi açılıyor…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="biz-panel padmin-panel padmin-login-page" data-testid="padmin-login-page">
      <div className="padmin-login-wrap">
        <p className="padmin-login-kicker">BiligN Platform</p>
        <SainaLoginView
          returnPath={SAINA_PLATFORM_ADMIN_ROUTE}
          title="Platform Yönetimi"
          subtitle="Yalnızca BiligN platform yöneticileri erişebilir. EZA rolü yeterli değildir."
          hideRegister
          footerNote="Business marka yönetimi için Business girişini kullanın."
        />
        <p className="padmin-login-alt">
          <Link href={SAINA_BUSINESS_ROUTE}>Business Yönetimi</Link>
          {' · '}
          <Link href="/standalone/discover">BiligN</Link>
        </p>
      </div>
    </main>
  );
}
