/** Product-scoped capabilities from /api/auth/me (hint only; backend enforces). */

export const BILIGN_PLATFORM_ADMIN_CAPABILITY = 'bilign.platform_admin' as const;

export type UserCapabilityId = typeof BILIGN_PLATFORM_ADMIN_CAPABILITY | string;

export function normalizeCapabilities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim());
}

export function hasCapability(
  user: { capabilities?: string[] | null } | null | undefined,
  capability: string
): boolean {
  return Boolean(user?.capabilities?.includes(capability));
}

export function hasBilignPlatformAdmin(
  user: { capabilities?: string[] | null } | null | undefined
): boolean {
  return hasCapability(user, BILIGN_PLATFORM_ADMIN_CAPABILITY);
}
