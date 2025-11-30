/**
 * Proxy Panel - Pages Router Wrapper
 * This file exists to maintain compatibility with Pages Router
 * The actual implementation is in app/proxy/page.tsx
 * 
 * Note: This is a temporary solution. Consider migrating fully to App Router.
 */

'use client';

import dynamic from 'next/dynamic';

// Dynamically import App Router component
const ProxyPageApp = dynamic(() => import('@/app/proxy/page'), {
  ssr: false,
});

export default function ProxyPage() {
  return <ProxyPageApp />;
}

