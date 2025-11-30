/**
 * Next.js Middleware - EZA Domain-based Access Control
 * 
 * Enforces domain-specific path access rules using rewrite.
 * Each domain rewrites to its allowed paths.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Statik yollar — ASLA rewrite edilmeyecek
 * Global allowed paths - accessible from any domain
 */
const PUBLIC_PATHS = [
  '/_next',         // Next.js statik dosyalar
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/assets',
  '/images',
  '/api',           // API çağrıları
  '/auth',          // Auth endpoints
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

  // Eğer statik dosyalardan biri çağrılıyorsa → rewrite etme
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 1) STANDALONE
   * standalone.ezacore.ai → /standalone
   ---------------------------------------------------- */
  if (hostname === 'standalone.ezacore.ai') {
    if (!pathname.startsWith('/standalone') && pathname !== '/login') {
      url.pathname = '/standalone';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 2) PROXY
   * proxy.ezacore.ai → /proxy
   ---------------------------------------------------- */
  if (hostname === 'proxy.ezacore.ai') {
    if (!pathname.startsWith('/proxy') && pathname !== '/login' && pathname !== '/proxy-lite') {
      url.pathname = '/proxy';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 3) PROXY-LITE
   * proxy-lite.ezacore.ai → /proxy-lite
   ---------------------------------------------------- */
  if (hostname === 'proxy-lite.ezacore.ai') {
    if (!pathname.startsWith('/proxy-lite') && pathname !== '/login') {
      url.pathname = '/proxy-lite';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 4) ADMIN
   * admin.ezacore.ai → /admin
   ---------------------------------------------------- */
  if (hostname === 'admin.ezacore.ai') {
    if (!pathname.startsWith('/admin') && pathname !== '/login') {
      url.pathname = '/admin';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 5) CORPORATE
   * corporate.ezacore.ai → /corporate
   ---------------------------------------------------- */
  if (hostname === 'corporate.ezacore.ai') {
    if (!pathname.startsWith('/corporate') && !pathname.startsWith('/proxy/corporate') && pathname !== '/login') {
      url.pathname = '/corporate';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 6) PLATFORM
   * platform.ezacore.ai → /proxy/platform
   ---------------------------------------------------- */
  if (hostname === 'platform.ezacore.ai') {
    if (!pathname.startsWith('/proxy/platform') && pathname !== '/login') {
      url.pathname = '/proxy/platform';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 7) REGULATOR
   * regulator.ezacore.ai → /regulator
   ---------------------------------------------------- */
  if (hostname === 'regulator.ezacore.ai') {
    if (!pathname.startsWith('/regulator') && !pathname.startsWith('/proxy/regulator') && pathname !== '/login') {
      url.pathname = '/regulator';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 8) EU-AI
   * eu-ai.ezacore.ai → /proxy/eu-ai
   ---------------------------------------------------- */
  if (hostname === 'eu-ai.ezacore.ai') {
    if (!pathname.startsWith('/proxy/eu-ai') && pathname !== '/login') {
      url.pathname = '/proxy/eu-ai';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ---------------------------------------------------
   * 9) SELECT PORTAL
   * select.ezacore.ai → /proxy/select-portal
   ---------------------------------------------------- */
  if (hostname === 'select.ezacore.ai') {
    if (!pathname.startsWith('/proxy/select-portal') && pathname !== '/login') {
      url.pathname = '/proxy/select-portal';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Diğer her şey normal çalışsın (localhost, unknown domains)
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
