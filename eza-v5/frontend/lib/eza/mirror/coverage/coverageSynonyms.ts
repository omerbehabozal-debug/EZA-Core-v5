/**
 * Coverage synonym layer — TR/EN normalization and explicit alias groups.
 * Production path: exact + synonym + diacritic-fold only (no Levenshtein).
 */

export type CoverageSynonymGroup = {
  id: string;
  canonical: string;
  variants: readonly string[];
  locale?: 'tr' | 'en' | 'both';
};

const TR_DIACRITIC_FOLD: Readonly<Record<string, string>> = {
  ş: 's',
  ğ: 'g',
  ü: 'u',
  ö: 'o',
  ç: 'c',
  ı: 'i',
  Ş: 's',
  Ğ: 'g',
  Ü: 'u',
  Ö: 'o',
  Ç: 'c',
  İ: 'i',
  I: 'i',
};

/** Fold Turkish diacritics for match-only comparison. */
export function foldTurkishDiacritics(text: string): string {
  let out = '';
  for (const ch of text) {
    out += TR_DIACRITIC_FOLD[ch] ?? ch;
  }
  return out;
}

/** Normalize user text for coverage pattern matching. */
export function normalizeCoverageText(text: string): string {
  const lowered = text.trim().toLowerCase();
  const nfkc = lowered.normalize('NFKC');
  const punct = nfkc.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~'-]/g, ' ');
  const collapsed = punct.replace(/\s+/g, ' ').trim();
  return collapsed ? ` ${collapsed} ` : '';
}

/** Normalize a single token for set membership checks. */
export function normalizeCoverageToken(token: string): string {
  return token.trim().toLowerCase().slice(0, 24);
}

function foldToken(token: string): string {
  return foldTurkishDiacritics(normalizeCoverageToken(token));
}

export const COVERAGE_SYNONYM_GROUPS: readonly CoverageSynonymGroup[] = [
  // Travel
  { id: 'semerkant', canonical: 'semerkant', variants: ['semerkand', 'semerkant', 'samarkand', 'registan'], locale: 'both' },
  { id: 'buhara', canonical: 'buhara', variants: ['buhara', 'bukhara', 'hive'], locale: 'both' },
  { id: 'ozbekistan', canonical: 'özbekistan', variants: ['özbekistan', 'ozbekistan', 'uzbekistan', 'özbek'], locale: 'both' },
  { id: 'ispanya', canonical: 'ispanya', variants: ['ispanya', 'spain'], locale: 'both' },
  { id: 'sevilla', canonical: 'sevilla', variants: ['sevilla', 'seville'], locale: 'both' },
  { id: 'endulus', canonical: 'endülüs', variants: ['endülüs', 'endulus', 'andalusia', 'andalucia'], locale: 'both' },
  { id: 'cordoba', canonical: 'cordoba', variants: ['cordoba', 'kordoba', 'córdoba'], locale: 'both' },
  { id: 'granada', canonical: 'granada', variants: ['granada', 'gırnata', 'girnata'], locale: 'both' },
  {
    id: 'mardin',
    canonical: 'mardin',
    variants: ['mardin', 'mardin evleri', 'taş şehir', 'tas sehir', 'tas sehir'],
    locale: 'tr',
  },
  // Architecture
  { id: 'tonoz', canonical: 'tonoz', variants: ['tonoz', 'vault', 'beşik tonoz', 'besik tonoz'], locale: 'both' },
  { id: 'rolove', canonical: 'rölöve', variants: ['rölöve', 'rolove'], locale: 'tr' },
  { id: 'restitusyon', canonical: 'restitüsyon', variants: ['restitüsyon', 'restitusyon'], locale: 'tr' },
  { id: 'restorasyon', canonical: 'restorasyon', variants: ['restorasyon', 'restoration'], locale: 'both' },
  { id: 'cami', canonical: 'cami', variants: ['cami', 'mosque', 'minare'], locale: 'both' },
  { id: 'kubbe', canonical: 'kubbe', variants: ['kubbe', 'dome'], locale: 'both' },
  { id: 'cephe', canonical: 'cephe', variants: ['cephe', 'facade'], locale: 'both' },
  { id: 'sove', canonical: 'söve', variants: ['söve', 'sove', 'molding', 'cornice'], locale: 'both' },
  { id: 'mermer', canonical: 'mermer', variants: ['mermer', 'marble'], locale: 'both' },
  { id: 'tas', canonical: 'taş', variants: ['taş', 'tas', 'stone'], locale: 'both' },
  { id: 'avlu', canonical: 'avlu', variants: ['avlu', 'courtyard', 'avlulu ev'], locale: 'both' },
  // Vehicle
  { id: 'elektrikli', canonical: 'elektrikli', variants: ['elektrikli', 'electric', 'electric vehicle'], locale: 'both' },
  { id: 'suv', canonical: 'suv', variants: ['suv', 'crossover'], locale: 'both' },
  { id: 'togg', canonical: 'togg', variants: ['togg', 't10x'], locale: 'both' },
  { id: 'bmw', canonical: 'bmw', variants: ['bmw'], locale: 'both' },
  { id: 'mercedes', canonical: 'mercedes', variants: ['mercedes', 'mercedes-benz'], locale: 'both' },
  { id: 'audi', canonical: 'audi', variants: ['audi'], locale: 'both' },
  // Technology
  { id: 'eza', canonical: 'eza', variants: ['eza', 'ezacore'], locale: 'both' },
  { id: 'cursor', canonical: 'cursor', variants: ['cursor'], locale: 'both' },
  { id: 'codex', canonical: 'codex', variants: ['codex'], locale: 'both' },
  { id: 'ai', canonical: 'ai', variants: ['ai', 'yapay zeka', 'artificial intelligence'], locale: 'both' },
  { id: 'mvp', canonical: 'mvp', variants: ['mvp'], locale: 'both' },
  { id: 'roadmap', canonical: 'roadmap', variants: ['roadmap', 'yol haritası', 'yol haritasi'], locale: 'both' },
  { id: 'startup', canonical: 'startup', variants: ['startup', 'start-up', 'girişim', 'girisim'], locale: 'both' },
  { id: 'urun', canonical: 'ürün', variants: ['ürün', 'urun', 'product'], locale: 'both' },
  // Travel context
  { id: 'seyahat', canonical: 'seyahat', variants: ['seyahat', 'travel', 'trip', 'journey', 'gezi'], locale: 'both' },
  { id: 'rota', canonical: 'rota', variants: ['rota', 'route', 'itinerary', 'yolculuk'], locale: 'both' },
  // Architecture context
  { id: 'mimari', canonical: 'mimari', variants: ['mimari', 'architecture', 'architect'], locale: 'both' },
];

const VARIANT_TO_CANONICAL = new Map<string, string>();
const FOLDED_VARIANT_TO_CANONICAL = new Map<string, string>();

for (const group of COVERAGE_SYNONYM_GROUPS) {
  for (const variant of group.variants) {
    const norm = normalizeCoverageToken(variant);
    if (norm) VARIANT_TO_CANONICAL.set(norm, group.canonical);
    const folded = foldToken(variant);
    if (folded) FOLDED_VARIANT_TO_CANONICAL.set(folded, group.canonical);
  }
  const canonNorm = normalizeCoverageToken(group.canonical);
  if (canonNorm) VARIANT_TO_CANONICAL.set(canonNorm, group.canonical);
  const canonFolded = foldToken(group.canonical);
  if (canonFolded) FOLDED_VARIANT_TO_CANONICAL.set(canonFolded, group.canonical);
}

/** Resolve a matched fragment to its canonical coverage token. */
export function canonicalizeCoverageToken(fragment: string): string | undefined {
  const norm = normalizeCoverageToken(fragment);
  if (!norm) return undefined;
  return (
    VARIANT_TO_CANONICAL.get(norm) ??
    FOLDED_VARIANT_TO_CANONICAL.get(foldToken(norm))
  );
}

/** Expand synonym group patterns for a canonical token. */
export function getSynonymVariants(canonicalOrGroupId: string): readonly string[] {
  const group = COVERAGE_SYNONYM_GROUPS.find(
    (g) => g.id === canonicalOrGroupId || g.canonical === canonicalOrGroupId
  );
  return group?.variants ?? [canonicalOrGroupId];
}

/** Match pattern against normalized text (exact, synonym-expanded, diacritic-folded). */
export function matchCoveragePattern(normalizedText: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;

  const tryMatch = (needle: string): boolean => {
    if (!needle) return false;
    if (needle.length <= 3 && /^[a-z0-9]+$/.test(needle)) {
      return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
        normalizedText
      );
    }
    return normalizedText.includes(` ${needle} `) || normalizedText.includes(needle);
  };

  if (tryMatch(p)) return true;

  const foldedPattern = foldTurkishDiacritics(p);
  if (foldedPattern !== p && tryMatch(foldedPattern)) return true;

  const canonical = canonicalizeCoverageToken(p);
  if (canonical) {
    const variants = getSynonymVariants(canonical);
    for (const variant of variants) {
      const v = variant.trim().toLowerCase();
      if (tryMatch(v)) return true;
      const fv = foldTurkishDiacritics(v);
      if (fv !== v && tryMatch(fv)) return true;
    }
  }

  return false;
}

/** Canonicalize an array of extracted tokens. */
export function canonicalizeCoverageTokens(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tokens) {
    const canon = canonicalizeCoverageToken(raw) ?? normalizeCoverageToken(raw);
    if (canon && !out.includes(canon)) out.push(canon);
  }
  return out;
}
