/**
 * Feature flag — SAINA cinematic shell on /standalone (Sprint B.1).
 * Set NEXT_PUBLIC_SAINA_STANDALONE_SHELL=true to enable; omit or false for legacy layout.
 */
export function isSainaStandaloneShellEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAINA_STANDALONE_SHELL === 'true';
}
