/**
 * EZA Mirror dev-only UI gates (stripped from production UX).
 */

export function isMirrorDevToolsEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}
