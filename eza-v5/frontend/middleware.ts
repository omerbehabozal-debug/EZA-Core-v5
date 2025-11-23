/**
 * Next.js Middleware - Domain-based Access Control
 * 
 * This middleware enforces domain-specific path access rules.
 * Each domain can only access its allowed paths, all other paths return 403 Forbidden.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain → Allowed Paths Mapping
 * Each domain can only access paths listed in its array
 */
const DOMAIN_ROUTES: Record<string, string[]> = {
  'standalone.ezacore.ai': ['/standalone'],
  'proxy.ezacore.ai': ['/proxy', '/proxy-lite'],
  'proxy-lite.ezacore.ai': ['/proxy-lite'],
  'admin.ezacore.ai': ['/admin'],
  'corporate.ezacore.ai': ['/proxy/corporate'],
  'eu-ai.ezacore.ai': ['/proxy/eu-ai'],
  'platform.ezacore.ai': ['/proxy/platform'],
  'regulator.ezacore.ai': ['/proxy/regulator'],
  'select.ezacore.ai': ['/proxy/select-portal'],
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
    // Unknown domain - deny access
    return false;
  }
  
  // Check if path matches any allowed path (exact or prefix match)
  return allowedPaths.some(allowedPath => 
    pathname === allowedPath || pathname.startsWith(allowedPath + '/')
  );
}

/**
 * Get clean hostname from request headers
 * Removes port number if present
 */
function getHostname(request: NextRequest): string {
  const host = request.headers.get('host') || '';
  // Remove port number if present (e.g., "proxy.ezacore.ai:3000" -> "proxy.ezacore.ai")
  return host.split(':')[0];
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = getHostname(request);
  
  // Allow global paths for all domains
  if (isGloballyAllowed(pathname)) {
    return NextResponse.next();
  }
  
  // Check if path is allowed for this domain
  if (isPathAllowedForDomain(pathname, hostname)) {
    return NextResponse.next();
  }
  
  // Path not allowed for this domain - return 403 Forbidden
  return new NextResponse('Forbidden', { status: 403 });
}

export const config = {
  matcher: '/:path*',
};
