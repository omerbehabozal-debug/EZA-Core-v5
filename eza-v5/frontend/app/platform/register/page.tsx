/**
 * Platform Register Page
 * Production-ready user registration
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'https://eza-core-v5-production.up.railway.app';

// Force dynamic rendering to avoid Suspense issues with search params
export const dynamic = 'force-dynamic';

export default function PlatformRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const router = useRouter();

  // Check for invitation token in URL (using window.location.search to avoid Suspense requirement)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setInvitationToken(token);
      }
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim() || !password || !confirmPassword) {
      setError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    // Email validation
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
      const requestBody: any = {
        email: email.trim().toLowerCase(),
        password: password,
        full_name: fullName.trim() || undefined,
      };
      
      // Add invitation token if present
      if (invitationToken) {
        requestBody.invitation_token = invitationToken;
      }
      
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      
      // Validate response
      if (!data.access_token || !data.role) {
        throw new Error('Invalid response from server');
      }

      // Registration successful - redirect to login page
      router.push('/platform/login?registered=true');
    } catch (err: any) {
      console.error('Register error:', err);
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        setError('Bu e-posta adresi ile zaten bir hesap mevcut');
      } else if (err.message.includes('Network') || err.message.includes('fetch')) {
        setError('Ağ hatası. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      } else {
        setError(err.message || 'Kayıt başarısız. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ 
        background: 'linear-gradient(135deg, #0B0E14 0%, #1A1F2E 50%, #0B0E14 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#3B82F6' }}>
            <span className="text-2xl font-bold text-white">EZA</span>
          </div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: '#F1F5F9' }}>
            EZA hesabınızı oluşturun
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Etik AI altyapısını kullanmaya başlayın
          </p>
        </div>

        {/* Register Card */}
        <div 
          className="rounded-2xl p-8 shadow-2xl"
          style={{ 
            backgroundColor: '#181F2B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Full Name (Optional) */}
            <div>
              <label 
                htmlFor="fullName" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Ad Soyad <span className="text-xs" style={{ color: '#64748B' }}>(İsteğe Bağlı)</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                  fontSize: '15px',
                }}
                placeholder="Ahmet Yılmaz"
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#334155';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                  fontSize: '15px',
                }}
                placeholder="ornek@email.com"
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#334155';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
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
                  autoComplete="new-password"
                  minLength={8}
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 rounded-xl border transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#121722',
                    borderColor: '#334155',
                    color: '#F1F5F9',
                    fontSize: '15px',
                  }}
                  placeholder="••••••••"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3B82F6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#334155';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#F1F5F9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94A3B8';
                  }}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: '#64748B' }}>
                En az 8 karakter
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Şifre Tekrar
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 rounded-xl border transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#121722',
                    borderColor: '#334155',
                    color: '#F1F5F9',
                    fontSize: '15px',
                  }}
                  placeholder="••••••••"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3B82F6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#334155';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#F1F5F9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94A3B8';
                  }}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className="p-4 rounded-xl text-sm flex items-start gap-3"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '3px solid #EF4444',
                }}
              >
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FCA5A5' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span style={{ color: '#FCA5A5' }}>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                backgroundColor: loading ? '#1E40AF' : '#3B82F6',
                color: '#FFFFFF',
                fontSize: '15px',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#3B82F6';
                }
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Hesap oluşturuluyor...</span>
                </>
              ) : (
                'Hesap Oluştur'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: '#64748B' }}>
              Zaten hesabınız var mı?{' '}
              <Link 
                href="/platform/login" 
                className="font-medium hover:underline transition-colors"
                style={{ color: '#3B82F6' }}
              >
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs" style={{ color: '#64748B' }}>
          <p>EZA AI Safety Platform</p>
        </div>
      </div>
    </div>
  );
}
