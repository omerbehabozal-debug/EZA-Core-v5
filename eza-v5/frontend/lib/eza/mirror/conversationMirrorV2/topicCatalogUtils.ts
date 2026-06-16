/** Shared deterministic pick helper for topic copy templates. */

export function hashPick(seed: string, items: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}
