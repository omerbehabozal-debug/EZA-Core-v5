/**
 * Proxy Login Page
 * Production-ready email/password authentication for Proxy UI
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'https://eza-core-v5-production.up.railway.app';

function ProxyLoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/proxy/select-organization');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      // Validate response
      if (!data.access_token || !data.role) {
        throw new Error('Invalid response from server');
      }

      // Store token and user info via AuthContext
      setAuth(data.access_token, {
        email: data.email,
        role: data.role,
        user_id: data.user_id,
      });

      // Redirect to organization selection (will auto-resolve if only one org)
      router.push('/proxy/select-organization');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message.includes('401') || err.message.includes('Incorrect')) {
        setError('Geçersiz e-posta veya şifre. Şifrenizi unuttuysanız şifre sıfırlama sayfasını kullanabilirsiniz.');
      } else if (err.message.includes('Network') || err.message.includes('fetch')) {
        setError('Ağ hatası. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      } else {
        setError(err.message || 'Giriş başarısız. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ 
        background: 'linear-gradient(135deg, #0F1115 0%, #151A21 50%, #0F1115 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#2563EB' }}>
            <span className="text-2xl font-bold text-white">EZA</span>
          </div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: '#E6EAF0' }}>
            Proxy Girişi
          </h1>
          <p className="text-sm" style={{ color: '#8E8E93' }}>
            Operasyonel AI Güvenlik Arayüzü
          </p>
        </div>

        {/* Login Card */}
        <div 
          className="rounded-2xl p-8 shadow-2xl"
          style={{ 
            backgroundColor: '#1C222B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E6EAF0' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border transition-all"
                style={{
                  backgroundColor: '#151A21',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#E6EAF0',
                }}
                placeholder="ornek@kurum.com"
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563EB';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E6EAF0' }}
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border transition-all pr-12"
                  style={{
                    backgroundColor: '#151A21',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#E6EAF0',
                  }}
                  placeholder="••••••••"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563EB';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  style={{ color: '#8E8E93' }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#2563EB' }}
                />
                <span className="text-sm" style={{ color: '#8E8E93' }}>
                  Beni hatırla
                </span>
              </label>
              <Link
                href="/platform/forgot-password"
                className="text-sm hover:underline"
                style={{ color: '#2563EB' }}
              >
                Şifremi unuttum
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className="p-4 rounded-xl text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '3px solid #EF4444',
                  color: '#FCA5A5',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? '#1E3A8A' : '#2563EB',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#1D4ED8';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                }
              }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: '#8E8E93' }}>
              Hesabınız yok mu?{' '}
              <Link
                href="/platform/register"
                className="hover:underline font-medium"
                style={{ color: '#2563EB' }}
              >
                Hesap oluştur
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProxyLoginPage() {
  return <ProxyLoginPageContent />;
}
