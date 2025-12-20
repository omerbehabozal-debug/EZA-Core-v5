/**
 * Management Route - Blocked in Proxy UI
 * Proxy UI is a sealed operational environment
 * Management functions are only available in Platform UI (platform.ezacore.ai)
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagementRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Proxy dashboard (no management access from Proxy UI)
    router.push('/proxy');
  }, [router]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4"
      style={{ 
        background: 'linear-gradient(135deg, #0F1115 0%, #151A21 50%, #0F1115 100%)',
      }}
    >
      <div 
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ 
          backgroundColor: '#1C222B',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <svg className="w-8 h-8" style={{ color: '#EF4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-2" style={{ color: '#E6EAF0' }}>
          Yönetim Paneli Erişimi Yok
        </h1>
        <p className="text-sm mb-6" style={{ color: '#8E8E93' }}>
          Proxy UI operasyonel bir ortamdır ve yönetim işlevleri içermez. Yönetim işlemleri için Platform UI'ı (platform.ezacore.ai) kullanmanız gerekmektedir.
        </p>
        <p className="text-xs mb-4" style={{ color: '#8E8E93' }}>
          Ana sayfaya yönlendiriliyorsunuz...
        </p>
      </div>
    </div>
  );
}
