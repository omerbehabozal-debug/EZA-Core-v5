/**
 * Extract hard / supporting / soft claims from canonical meaning lineage.
 * Sources: Semantic Anchors + D2 interpretation + PublicMirrorLanding.
 * Never V3 labels / CATEGORY / curiosity bundles.
 */

import { djb2Hex } from '@/lib/eza/mirror/mirrorLineageHash';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { PublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';
import { claimKey, normalizeClaimText } from '@/lib/eza/mirror/narrativeAlignment/aliases';
import type {
  ExtractedClaims,
  NarrativeClaim,
  NarrativeClaimType,
} from '@/lib/eza/mirror/narrativeAlignment/types';

const SOFT_LEXICON = new Set(
  [
    'quiet',
    'peaceful',
    'premium',
    'nostalgic',
    'safe',
    'comfortable',
    'elegant',
    'calm',
    'warm',
    'soft',
    'slow',
    'local',
    'intimate',
    'hushed',
    'sessiz',
    'sakin',
    'huzurlu',
    'konfor',
    'comfort',
    'güvenlik',
    'safety',
    'family',
    'aile',
  ].map((s) => normalizeClaimText(s))
);

const SETTING_HINTS = [
  'showroom',
  'car showroom',
  'dealership',
  'stone street',
  'yellow stone street',
  'taş sokak',
  'courtyard',
  'avlu',
  'terrace',
  'teras',
  'galeri',
];

function isSoft(value: string): boolean {
  const n = normalizeClaimText(value);
  if (SOFT_LEXICON.has(n)) return true;
  return [...SOFT_LEXICON].some((s) => n === s || (s.length > 4 && n.includes(s)));
}

function pushUnique(
  list: NarrativeClaim[],
  claim: Omit<NarrativeClaim, 'key'> & { key?: string }
): void {
  const key = claim.key ?? claimKey(claim.value);
  if (!key || key.length < 2) return;
  if (list.some((c) => c.key === key && c.type === claim.type)) return;
  list.push({ ...claim, key });
}

/** Split compare topics like "BMW X3 vs Mercedes GLC" into product tokens. */
function extractCompareProducts(topic: string | null | undefined): string[] {
  if (!topic) return [];
  const parts = topic.split(/\s+(?:vs\.?|versus|mü|mi|mu|mü\?|or|yoksa)\s+/i);
  if (parts.length < 2) {
    // Also catch "A mü B mi?"
    const q = topic.match(
      /([A-Za-zÇĞİÖŞÜçğıöşü0-9][A-Za-zÇĞİÖŞÜçğıöşü0-9\s-]{1,40}?)\s+mü\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9][A-Za-zÇĞİÖŞÜçğıöşü0-9\s-]{1,40}?)\s+mi/i
    );
    if (q) return [q[1]!.trim(), q[2]!.trim()];
    return [];
  }
  return parts.map((p) => p.replace(/[?？]/g, '').trim()).filter(Boolean);
}

function classifyObject(value: string): NarrativeClaimType {
  const n = normalizeClaimText(value);
  if (/minare|minaret/.test(n)) return 'landmark';
  if (SETTING_HINTS.some((h) => n.includes(normalizeClaimText(h)) || normalizeClaimText(h).includes(n))) {
    return 'setting';
  }
  if (/bmw|mercedes|toyota|audi|volvo|x3|glc/.test(n)) {
    return /x3|glc|model|class/.test(n) ? 'product' : 'brand';
  }
  return 'object';
}

function landingBlob(landing: Pick<PublicMirrorLanding, 'publicTitle' | 'publicSummary'>): string {
  return normalizeClaimText(`${landing.publicTitle} ${landing.publicSummary}`);
}

function mentionedInLanding(claimValue: string, landingNorm: string): boolean {
  const key = claimKey(claimValue);
  const n = normalizeClaimText(claimValue);
  if (!key) return false;
  if (landingNorm.includes(n) || landingNorm.includes(key)) return true;
  // token pieces (bmw, x3, mercedes, glc, mardin…)
  const tokens = n.split(/\s+/).filter((t) => t.length >= 2);
  const hit = tokens.filter((t) => landingNorm.includes(t) || landingNorm.includes(claimKey(t)));
  return hit.length >= Math.min(2, tokens.length) || (tokens.length === 1 && hit.length === 1);
}

export type ExtractHardClaimsInput = {
  anchors: MirrorSemanticAnchorsV1;
  interpretation?: Pick<
    MirrorInterpretationV1,
    'title' | 'visualNarrative' | 'interpretationSummary' | 'imageIntent'
  > | null;
  landing: Pick<PublicMirrorLanding, 'publicTitle' | 'publicSummary'>;
};

/**
 * Build claim sets from canonical lineage. Soft emotions never become required.
 */
export function extractHardClaims(input: ExtractHardClaimsInput): ExtractedClaims {
  const candidates: NarrativeClaim[] = [];
  const softClaims: string[] = [];

  const { anchors, interpretation, landing } = input;
  const landingNorm = landingBlob(landing);

  if (anchors.place && !isSoft(anchors.place)) {
    pushUnique(candidates, {
      type: 'place',
      value: anchors.place,
      importance: 'supporting',
    });
  }

  for (const scene of anchors.scene) {
    if (!scene?.trim()) continue;
    if (isSoft(scene)) {
      softClaims.push(scene);
      continue;
    }
    pushUnique(candidates, {
      type: classifyObject(scene),
      value: scene,
      importance: 'supporting',
    });
  }

  for (const emo of anchors.emotion) {
    if (emo?.trim()) softClaims.push(emo);
  }
  for (const c of anchors.decisionCriteria) {
    if (c?.trim() && isSoft(c)) softClaims.push(c);
  }

  const products = extractCompareProducts(anchors.topic);
  for (const p of products) {
    if (isSoft(p)) continue;
    pushUnique(candidates, {
      type: classifyObject(p),
      value: p,
      importance: 'supporting',
    });
  }

  // D2 visual narrative may name settings/objects already in anchors — only add concrete settings.
  const narrative = interpretation?.visualNarrative || '';
  for (const hint of SETTING_HINTS) {
    if (normalizeClaimText(narrative).includes(normalizeClaimText(hint))) {
      pushUnique(candidates, {
        type: 'setting',
        value: hint,
        importance: 'supporting',
      });
    }
  }
  if (normalizeClaimText(landingNorm).includes('showroom') || /showroom|galeri/.test(landingNorm)) {
    pushUnique(candidates, {
      type: 'setting',
      value: 'showroom',
      importance: 'supporting',
    });
  }

  // Importance: mentioned in landing → required; else supporting.
  // Compare products: if ANY product from a vs-pair is in landing, ALL pair members become required.
  const compareKeys = new Set(products.map((p) => claimKey(p)));
  const anyCompareInLanding = products.some((p) => mentionedInLanding(p, landingNorm));

  const requiredClaims: NarrativeClaim[] = [];
  const supportingClaims: NarrativeClaim[] = [];

  for (const claim of candidates) {
    const inLanding = mentionedInLanding(claim.value, landingNorm);
    const inComparePair = compareKeys.has(claim.key) && anyCompareInLanding;
    const importance =
      inLanding || inComparePair || (claim.type === 'place' && inLanding)
        ? 'required'
        : claim.type === 'place' && anchors.place
          ? mentionedInLanding(anchors.place, landingNorm)
            ? 'required'
            : 'supporting'
          : 'supporting';

    const next = { ...claim, importance: importance as NarrativeClaim['importance'] };
    if (next.importance === 'required') {
      // Place: if landing mentions place name, required
      if (claim.type === 'place' && anchors.place && mentionedInLanding(anchors.place, landingNorm)) {
        next.importance = 'required';
      }
      pushUnique(requiredClaims, next);
    } else {
      pushUnique(supportingClaims, next);
    }
  }

  // Place special-case: landing mentions place → required
  if (anchors.place && mentionedInLanding(anchors.place, landingNorm)) {
    pushUnique(requiredClaims, {
      type: 'place',
      value: anchors.place,
      importance: 'required',
    });
    // remove from supporting if present
    const idx = supportingClaims.findIndex((c) => c.type === 'place' && c.key === claimKey(anchors.place!));
    if (idx >= 0) supportingClaims.splice(idx, 1);
  }

  // Settings mentioned in landing → required
  for (const claim of [...supportingClaims]) {
    if (claim.type === 'setting' && mentionedInLanding(claim.value, landingNorm)) {
      pushUnique(requiredClaims, { ...claim, importance: 'required' });
      const idx = supportingClaims.findIndex((c) => c.key === claim.key && c.type === claim.type);
      if (idx >= 0) supportingClaims.splice(idx, 1);
    }
  }

  // Objects/landmarks mentioned in landing → required
  for (const claim of [...supportingClaims]) {
    if (
      (claim.type === 'object' || claim.type === 'landmark') &&
      mentionedInLanding(claim.value, landingNorm)
    ) {
      pushUnique(requiredClaims, { ...claim, importance: 'required' });
      const idx = supportingClaims.findIndex((c) => c.key === claim.key && c.type === claim.type);
      if (idx >= 0) supportingClaims.splice(idx, 1);
    }
  }

  // Vehicle compare: concrete setting from lineage becomes required context (not soft).
  const hasRequiredProduct = requiredClaims.some(
    (c) => c.type === 'product' || c.type === 'brand'
  );
  if (hasRequiredProduct) {
    for (const claim of [...supportingClaims]) {
      if (claim.type === 'setting') {
        pushUnique(requiredClaims, { ...claim, importance: 'required' });
        const idx = supportingClaims.findIndex((c) => c.key === claim.key && c.type === claim.type);
        if (idx >= 0) supportingClaims.splice(idx, 1);
      }
    }
  }

  const uniqSoft = [...new Set(softClaims.map((s) => normalizeClaimText(s)).filter(Boolean))];

  const requiredClaimsHash = djb2Hex(
    JSON.stringify(
      requiredClaims
        .map((c) => ({ t: c.type, k: c.key }))
        .sort((a, b) => `${a.t}:${a.k}`.localeCompare(`${b.t}:${b.k}`))
    )
  );

  return {
    requiredClaims,
    supportingClaims,
    softClaims: uniqSoft,
    requiredClaimsHash,
  };
}
