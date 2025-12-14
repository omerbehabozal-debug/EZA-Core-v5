/**
 * Management Route Redirect
 * Redirects to Platform domain
 */

'use client';

import { useEffect } from 'react';

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://platform.ezacore.ai';

export default function ManagementRedirect() {
  useEffect(() => {
    window.location.href = PLATFORM_URL;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
      <div className="text-center">
        <p className="text-lg mb-4" style={{ color: '#E5E5EA' }}>
          Yönetim paneline yönlendiriliyorsunuz...
        </p>
        <p className="text-sm" style={{ color: '#8E8E93' }}>
          <a href={PLATFORM_URL} className="text-[#007AFF] hover:underline">
            Buraya tıklayın
          </a>{' '}
          eğer otomatik yönlendirme çalışmazsa.
        </p>
      </div>
    </div>
  );
}
