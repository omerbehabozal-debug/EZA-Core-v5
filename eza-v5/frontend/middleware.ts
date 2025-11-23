/**
 * Next.js Middleware - Domain-based routing
 * Handles routing based on domain before page loads
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Check if it's proxy domain
  if (hostname === 'proxy.ezacore.ai' || hostname.includes('proxy')) {
    // If already on /proxy, allow it
    if (request.nextUrl.pathname.startsWith('/proxy')) {
      return NextResponse.next();
    }
    // Redirect root to /proxy
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/proxy', request.url));
    }
  } else {
    // For standalone domain or default, redirect root to /standalone
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/standalone', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

