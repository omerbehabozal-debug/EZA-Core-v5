/**
 * Alias / synonym table for Narrative Alignment matching.
 * Generic equivalents only — no topic-specific publish logic.
 */

export function normalizeClaimText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"'`]/g, '')
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Each group is a set of equivalent surface forms (lowercase). */
const CLAIM_ALIAS_GROUPS_RAW: ReadonlyArray<ReadonlyArray<string>> = [
  ['mercedes', 'mercedes-benz', 'mercedes benz', 'merc'],
  ['bmw', 'bayerische motoren werke'],
  ['tea', 'tea glass', 'çay', 'çay bardağı', 'çay bardagi', 'glass of tea', 'cay'],
  ['wooden chair', 'wood chair', 'tahta sandalye', 'sandalye', 'chair'],
  ['minaret', 'mosque minaret', 'minare'],
  ['laundry line', 'clothesline', 'çamaşır ipi', 'çamaşır ipleri', 'camasir ipi'],
  ['showroom', 'car showroom', 'auto showroom', 'dealership', 'galeri'],
  ['stone street', 'yellow stone street', 'taş sokak', 'tas sokak', 'stone alley'],
  ['mardin', 'mârdîn'],
  ['x3', 'bmw x3'],
  ['glc', 'mercedes glc', 'mercedes-benz glc'],
];

/** Pre-normalized alias groups for matching after diacritic fold. */
export const CLAIM_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = CLAIM_ALIAS_GROUPS_RAW.map(
  (group) => [...new Set(group.map((g) => normalizeClaimText(g)))]
);

export function claimKey(value: string): string {
  const n = normalizeClaimText(value);
  for (const group of CLAIM_ALIAS_GROUPS) {
    if (group.some((g) => g === n || n.includes(g) || g.includes(n))) {
      // Canonical = shortest stable token in group (prefer brand roots).
      return [...group].sort((a, b) => a.length - b.length)[0]!;
    }
  }
  return n;
}

export function claimsEquivalent(a: string, b: string): boolean {
  const ka = claimKey(a);
  const kb = claimKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // Avoid BMW → generic SUV: require key equality or containment of same alias key only.
  if (ka.length >= 3 && kb.length >= 3 && (ka.includes(kb) || kb.includes(ka))) {
    // Block ultra-generic collapses
    if (ka === 'suv' || kb === 'suv' || ka === 'car' || kb === 'car') return false;
    return true;
  }
  return false;
}
