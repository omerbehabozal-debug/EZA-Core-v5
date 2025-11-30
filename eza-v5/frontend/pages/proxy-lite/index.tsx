/**
 * Proxy-Lite Panel - Pages Router Wrapper
 * This file exists to maintain compatibility with Pages Router
 * The actual implementation is in app/proxy-lite/page.tsx
 * 
 * Note: This is a temporary solution. Consider migrating fully to App Router.
 */

'use client';

import dynamic from 'next/dynamic';

// Dynamically import App Router component
const ProxyLitePageApp = dynamic(() => import('@/app/proxy-lite/page'), {
  ssr: false,
});

export default function ProxyLitePage() {
  return <ProxyLitePageApp />;
}

