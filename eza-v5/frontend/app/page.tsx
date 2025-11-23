/**
 * Root Page - Domain-based redirect
 * - proxy.ezacore.ai -> /proxy
 * - standalone.ezacore.ai or default -> /standalone
 */

'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // Check if it's proxy domain
      if (hostname === 'proxy.ezacore.ai' || hostname.includes('proxy')) {
        window.location.href = '/proxy';
      } else {
        // Default: redirect to standalone
        window.location.href = '/standalone';
      }
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">EZA Proxy UI System</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">Redirecting...</p>
        <p className="text-sm text-gray-400 mt-2">
          If redirect doesn't work,{' '}
          <a href="/proxy" className="text-blue-600 underline">Proxy</a> or{' '}
          <a href="/standalone" className="text-blue-600 underline">Standalone</a>
        </p>
      </div>
    </div>
  );
}

