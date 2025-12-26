/**
 * Regulator Panel Login Page
 * 
 * Enterprise-Grade Authentication
 * - No self-signup
 * - Controlled password reset
 * - Brute force protection
 * - Audit logging
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PasswordResetRequestModal } from '@/components/PasswordResetRequestModal';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/rate-limit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Brute force protection: Check rate limit
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      setError('Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Invalid credentials' }));
        // Record failed attempt for rate limiting
        recordFailedAttempt(email);
        throw new Error(errorData.detail || 'Geçersiz email veya şifre');
      }

      const data = await response.json();
      const token = data.access_token || data.token;

      if (!token) {
        throw new Error('Token alınamadı');
      }

      // Decode token to check role
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || payload.roles?.[0];
        
        // Check if user has regulator role
        if (!['REGULATOR_READONLY', 'REGULATOR_AUDITOR'].includes(userRole)) {
          throw new Error('Bu panele erişim yetkiniz bulunmamaktadır. Yalnızca REGULATOR_READONLY veya REGULATOR_AUDITOR rolleri erişebilir.');
        }
      } catch (decodeError) {
        console.error('Token decode error:', decodeError);
        // Continue anyway - backend will validate
      }

      // Store token
      apiClient.setAuthToken(token);
      localStorage.setItem('regulator_token', token);

      // Clear rate limit on success
      clearRateLimit(email);

      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Giriş başarısız';
      setError(errorMessage);
      
      // Log failed login attempt (client-side, backend also logs)
      console.warn(`[Regulator Login] Failed attempt for ${email}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-regulator-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-regulator-primary mb-2">
            Regulator Oversight Panel
          </h1>
          <p className="text-sm text-gray-600">
            Yetkilendirilmiş düzenleyiciler için
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || !checkRateLimit(email).allowed}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || !checkRateLimit(email).allowed}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{error}</p>
              {!checkRateLimit(email).allowed && (
                <p className="text-xs text-red-600 mt-1">
                  Güvenlik nedeniyle giriş geçici olarak engellendi. 15 dakika sonra tekrar deneyin.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !checkRateLimit(email).allowed}
            className="w-full bg-regulator-primary text-white rounded px-4 py-2 font-medium hover:bg-regulator-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        {/* Password Reset Request Link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Şifre sıfırlama talebi
          </button>
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Bu panel içerik görüntülemez ve editoryal karar almaz.
            <br />
            Erişim yalnızca yetkilendirilmiş düzenleyiciler içindir.
          </p>
        </div>
      </div>

      {/* Password Reset Request Modal */}
      {showResetModal && (
        <PasswordResetRequestModal
          onClose={() => setShowResetModal(false)}
          apiBaseUrl={API_BASE_URL}
        />
      )}
    </div>
  );
}
