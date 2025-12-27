import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for Finance token in cookies
  const token = request.cookies.get('finance_token');
  const pathname = request.nextUrl.pathname;

  // Allow access to login and unauthorized pages
  if (pathname === '/login' || pathname === '/unauthorized') {
    return NextResponse.next();
  }

  // If no token and trying to access protected route, redirect to login
  if (!token && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

