/**
 * Middleware for Regulator Panel
 * 
 * Protects routes and ensures only regulator roles can access.
 * This is FRONTEND-ONLY enforcement - no backend changes.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow login and unauthorized pages
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/unauthorized'
  ) {
    return NextResponse.next();
  }

  // Check for token in cookie or header
  const token = request.cookies.get('regulator_token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Token validation happens in auth-guard component
  // Middleware just checks for presence
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

