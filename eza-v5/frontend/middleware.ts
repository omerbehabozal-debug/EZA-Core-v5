/**
 * Next.js Middleware - EZA Domain-based Access Control
 * 
 * Enforces domain-specific path access rules.
 * Each domain can only access its allowed paths, all other paths return 403 Forbidden.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain → Allowed Paths Mapping
 * Each domain can only access paths listed in its array
 */
const DOMAIN_ROUTES: Record<string, string[]> = {
  'standalone.ezacore.ai': ['/standalone', '/login'],
  'proxy.ezacore.ai': ['/proxy', '/proxy-lite', '/login'],
  'proxy-lite.ezacore.ai': ['/proxy-lite', '/login'],
  'admin.ezacore.ai': ['/admin', '/login'],
  'corporate.ezacore.ai': ['/corporate', '/proxy/corporate', '/login'],
  'eu-ai.ezacore.ai': ['/proxy/eu-ai', '/login'],
  'platform.ezacore.ai': ['/proxy/platform', '/login'],
  'regulator.ezacore.ai': ['/regulator', '/proxy/regulator', '/login'],
  'select.ezacore.ai': ['/proxy/select-portal', '/login'],
};

/**
 * Global allowed paths - accessible from any domain
 * These paths are always allowed regardless of domain restrictions
 */
const GLOBAL_ALLOWED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/api', // API routes
];

/**
 * Check if a path is globally allowed
 */
function isGloballyAllowed(pathname: string): boolean {
  return GLOBAL_ALLOWED_PATHS.some(allowedPath => 
    pathname === allowedPath || pathname.startsWith(allowedPath + '/')
  );
}

/**
 * Check if a path is allowed for a specific domain
 */
function isPathAllowedForDomain(pathname: string, domain: string): boolean {
  const allowedPaths = DOMAIN_ROUTES[domain];
  
  if (!allowedPaths) {
    return false;
  }
  
  // Check if path matches any allowed path (exact or prefix match)
  return allowedPaths.some(allowedPath => 
    pathname === allowedPath || pathname.startsWith(allowedPath + '/')
  );
}

/**
 * Get clean hostname from request headers (lowercase)
 */
function getHostname(request: NextRequest): string {
  const host = request.headers.get('host')?.toLowerCase() || '';
  // Remove port number if present
  return host.split(':')[0];
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = getHostname(request);
  
  // Allow global paths for all domains
  if (isGloballyAllowed(pathname)) {
    return NextResponse.next();
  }
  
  // Handle root path redirects
  if (pathname === '/') {
    const allowedPaths = DOMAIN_ROUTES[hostname];
    if (allowedPaths && allowedPaths.length > 0) {
      // Redirect to first allowed path
      return NextResponse.redirect(new URL(allowedPaths[0], request.url));
    }
    // Unknown domain - return 403 Forbidden
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Check if path is allowed for this domain
  if (isPathAllowedForDomain(pathname, hostname)) {
    return NextResponse.next();
  }
  
  // Path not allowed for this domain - return 403 Forbidden JSON
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export const config = {
  matcher: '/:path*',
};
