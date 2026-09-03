/**
 * Collision-resistant client IDs for server-backed conversation persistence.
 * Historical Date.now()-based IDs are preserved; only NEW ids use this helper.
 */

export function generateStableClientId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}-${suffix}`;
}

export function generateChatClientId(prefix = 'chat'): string {
  return generateStableClientId(prefix);
}

export function generateMessageClientId(prefix: 'user' | 'eza'): string {
  return generateStableClientId(prefix);
}
