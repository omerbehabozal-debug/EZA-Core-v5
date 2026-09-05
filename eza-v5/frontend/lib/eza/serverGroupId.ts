/**
 * Optional server groupId helpers — Phase 8.8G-5 / 2.2.
 *
 * Local conversation groups use non-UUID ids (e.g. group-{ts}-{rand}).
 * Server columns expect UUID or null. Invalid optional metadata must be
 * omitted, never cause conversation content rejection.
 */

/** Canonical UUID string form accepted by backend UUID() parsers for group ids. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidServerGroupUuid(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_RE.test(trimmed);
}

/**
 * Preserve valid UUID group ids; omit empty/invalid/legacy local ids.
 * Does not rewrite local archive storage — callers use this for API payloads only.
 */
export function sanitizeOptionalServerGroupId(
  value: string | null | undefined
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!isValidServerGroupUuid(trimmed)) return undefined;
  return trimmed;
}
