/**
 * Root Page - Auto-redirect to Standalone
 * This page automatically redirects to /standalone for better UX
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to standalone after a short delay
    const timer = setTimeout(() => {
      router.push('/standalone');
    }, 500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">EZA Proxy UI System</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">Redirecting to Standalone...</p>
        <p className="text-sm text-gray-400 mt-2">
          If redirect doesn't work,{' '}
          <a href="/standalone" className="text-blue-600 underline hover:text-blue-800">click here</a>
        </p>
      </div>
    </div>
  );
}

