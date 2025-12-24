/**
 * Organization Masking Utility
 * 
 * Masks organization identifiers to prevent content association.
 * Real organization names are NEVER shown to regulators.
 */

/**
 * Mask an organization ID to a safe format
 * Format: ORG-XXXX (where XXXX is a stable hash-based identifier)
 */
export function maskOrganizationId(orgId: string): string {
  if (!orgId) {
    return 'ORG-UNKNOWN';
  }

  // Create a stable hash from the org ID
  // Using a simple hash function (in production, use crypto.subtle)
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    const char = orgId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive 4-digit number
  const masked = Math.abs(hash % 10000).toString().padStart(4, '0');
  return `ORG-${masked}`;
}

/**
 * Mask organization name (if provided)
 * Returns masked ID format
 */
export function maskOrganizationName(name: string | null | undefined, orgId: string): string {
  // Always use ID-based masking, never show real names
  return maskOrganizationId(orgId);
}

/**
 * Check if a string is already masked
 */
export function isMasked(identifier: string): boolean {
  return /^ORG-\d{4}$/.test(identifier);
}

