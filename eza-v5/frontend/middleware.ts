/**
 * Next.js Middleware - EZA Domain-based Access Control
 * 
 * Her domain tek bir sayfaya yönlendirir.
 * Temiz ve profesyonel bir yapı için her panel/ürün için tek domain.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain → Target Path Mapping
 * Her domain tek bir sayfaya yönlendirir
 */
const DOMAIN_ROUTES: Record<string, string> = {
  'standalone.ezacore.ai': '/standalone',
  'proxy.ezacore.ai': '/proxy',
  'proxy-lite.ezacore.ai': '/proxy-lite',
  'admin.ezacore.ai': '/admin',
  'corporate.ezacore.ai': '/corporate',
  'platform.ezacore.ai': '/platform',
  'regulator.ezacore.ai': '/regulator',
  'eu-ai.ezacore.ai': '/proxy/eu-ai',
  'select.ezacore.ai': '/proxy/select-portal',
};

/**
 * Statik yollar — ASLA rewrite edilmeyecek
 */
const PUBLIC_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/assets',
  '/images',
  '/api',
  '/auth',
];

/**
 * Check if path is a public path (should not be rewritten)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

/**
 * Get clean hostname from request headers (lowercase, no port)
 */
function getHostname(request: NextRequest): string {
  const host = request.headers.get('host')?.toLowerCase() || '';
  return host.split(':')[0];
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const hostname = getHostname(request);

  // Statik dosyalar ve API'ler → rewrite etme
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Domain mapping'de yoksa → normal çalışsın (localhost, unknown domains)
  const targetPath = DOMAIN_ROUTES[hostname];
  if (!targetPath) {
    return NextResponse.next();
  }

  // Login sayfaları → her zaman erişilebilir
  if (pathname === '/login' || 
      pathname.startsWith('/proxy/login') || 
      pathname.startsWith('/corporate/login') ||
      pathname.startsWith('/platform/login')) {
    return NextResponse.next();
  }

  // Root path (/) için target path'e yönlendir
  if (pathname === '/') {
    url.pathname = targetPath;
    return NextResponse.rewrite(url);
  }

  // Zaten target path'teyse → rewrite etme
  if (pathname === targetPath || pathname.startsWith(targetPath + '/')) {
    return NextResponse.next();
  }

  // Diğer tüm path'ler → target path'e rewrite et
  url.pathname = targetPath;
  return NextResponse.rewrite(url);
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
