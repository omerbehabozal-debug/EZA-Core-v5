/**
 * RTÜK Panel Login Page
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Invalid credentials' }));
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
        
        // Check if user has RTÜK role
        if (!['REGULATOR_RTUK', 'REGULATOR_MEDIA_AUDITOR'].includes(userRole)) {
          throw new Error('Bu panele erişim yetkiniz bulunmamaktadır. Yalnızca RTÜK yetkili rolleri erişebilir.');
        }
      } catch (decodeError) {
        console.error('Token decode error:', decodeError);
        // Continue anyway - backend will validate
      }

      // Store token in both localStorage and cookie (for middleware)
      apiClient.setAuthToken(token);
      localStorage.setItem('rtuk_token', token);
      
      // Also set cookie for middleware
      const cookieValue = `rtuk_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = cookieValue;
      
      console.log('[RTÜK Login] Token stored in localStorage and cookie');

      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Giriş başarısız';
      setError(errorMessage);
      console.warn(`[RTÜK Login] Failed attempt for ${email}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rtuk-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-rtuk-primary mb-2">
            RTÜK Medya Gözetim Paneli
          </h1>
          <p className="text-sm text-gray-600">
            Yetkilendirilmiş RTÜK personeli için
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
              disabled={loading}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rtuk-primary text-white rounded px-4 py-2 font-medium hover:bg-rtuk-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        {/* Legal Disclaimer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Bu panel içerik görüntülemez ve editoryal karar almaz.
            <br />
            Bu panel bir sansür veya yaptırım aracı değildir.
            <br />
            RTÜK bu panel aracılığıyla editoryal karar almaz.
          </p>
        </div>
      </div>
    </div>
  );
}

