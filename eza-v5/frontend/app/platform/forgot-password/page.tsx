/**
 * Forgot Password Page (Placeholder)
 * Future: Password reset functionality
 */

'use client';

import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ 
        background: 'linear-gradient(135deg, #0B0E14 0%, #1A1F2E 50%, #0B0E14 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#3B82F6' }}>
            <span className="text-2xl font-bold text-white">EZA</span>
          </div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: '#F1F5F9' }}>
            Şifre Sıfırlama
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Şifre sıfırlama özelliği yakında eklenecek
          </p>
        </div>

        <div 
          className="rounded-2xl p-8 shadow-2xl text-center"
          style={{ 
            backgroundColor: '#181F2B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
            Şifrenizi sıfırlamak için lütfen yöneticinizle iletişime geçin.
          </p>
          <Link
            href="/platform/login"
            className="inline-block px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
            }}
          >
            Giriş Sayfasına Dön
          </Link>
        </div>
      </div>
    </div>
  );
}

