/**
 * Phase 8.1 / 8.1.1 — fail-closed guards for dev/lab frontend surfaces.
 *
 * Lab/dev pages are allowed only on local dev or explicitly approved deploy envs.
 * Unknown/missing runtime env on public hosts → fail closed.
 */

const EZACORE_HOST_SUFFIX = '.ezacore.ai';
const EZACORE_APEX = 'ezacore.ai';

/** Explicit deploy env labels where dev/lab tooling may exist. */
export const NON_PRODUCTION_SURFACE_ENV_VALUES = [
  'dev',
  'development',
  'test',
  'ci',
  'staging',
] as const;

/** Paths blocked unless non-production surface is explicitly allowed. */
export const NON_PRODUCTION_FRONTEND_PATH_PREFIXES = [
  '/standalone/mirror-v2-lab',
  '/dev',
  '/docs/test-suite',
] as const;

function isEzacoreProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0];
  return host === EZACORE_APEX || host.endsWith(EZACORE_HOST_SUFFIX);
}

function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0];
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveExplicitDeployEnvLabel(): string | null {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercel) return vercel;
  const eza = process.env.EZA_DEPLOY_ENV?.trim().toLowerCase();
  if (eza) return eza;
  const pub = process.env.NEXT_PUBLIC_EZA_DEPLOY_ENV?.trim().toLowerCase();
  if (pub) return pub;
  return null;
}

export function isExplicitNonProductionFrontendSurfaceAllowed(
  hostname?: string
): boolean {
  const host =
    (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : ''))
      .trim()
      .toLowerCase();

  if (isLocalDevHost(host)) {
    return true;
  }

  if (host && isEzacoreProductionHost(host)) {
    return false;
  }

  const label = resolveExplicitDeployEnvLabel();
  if (!label) {
    return false;
  }
  if (label === 'production') {
    return false;
  }
  return (NON_PRODUCTION_SURFACE_ENV_VALUES as readonly string[]).includes(label);
}

/** @deprecated Use isExplicitNonProductionFrontendSurfaceAllowed — kept for callers. */
export function isProductionFrontendDeploy(hostname?: string): boolean {
  return !isExplicitNonProductionFrontendSurfaceAllowed(hostname);
}

export function isNonProductionFrontendPath(pathname: string): boolean {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  return NON_PRODUCTION_FRONTEND_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function shouldBlockProductionFrontendSurface(
  pathname: string,
  hostname?: string
): boolean {
  if (!isNonProductionFrontendPath(pathname)) {
    return false;
  }
  return !isExplicitNonProductionFrontendSurfaceAllowed(hostname);
}
