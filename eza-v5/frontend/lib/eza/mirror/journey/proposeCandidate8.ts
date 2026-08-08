/**
 * Candidate 8 — coherent curiosity journey selection (Phase 2 PASS).
 * Lexical / clustering heuristic only — no Anchors / D2.
 */

import {
  extractQaPairs,
  isLowInformationQuestion,
} from './extractQaPairs';
import {
  JOURNEY_CANDIDATE_COUNT,
  type Candidate8Result,
  type CandidatePath,
  type EligibleQaPair,
  type JourneyMessageLike,
} from './types';

const STOP = new Set([
  've',
  'veya',
  'ile',
  'bir',
  'bu',
  'şu',
  'o',
  'mi',
  'mı',
  'mu',
  'mü',
  'de',
  'da',
  'ki',
  'için',
  'ama',
  'çok',
  'daha',
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'is',
  'it',
]);

const NEAR_DUP_THRESHOLD = 0.82;
const CLUSTER_OVERLAP_THRESHOLD = 0.18;
const MIN_PATH_COHERENCE = 0.12;

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçâîûäöüß\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  Array.from(a).forEach((t) => {
    if (b.has(t)) inter += 1;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function questionTokens(pair: EligibleQaPair): Set<string> {
  return tokenize(pair.publicQuestion);
}

function pairTokens(pair: EligibleQaPair): Set<string> {
  return new Set(
    Array.from(tokenize(pair.publicQuestion)).concat(
      Array.from(tokenize(pair.publicAnswer))
    )
  );
}

export function areNearDuplicateQuestions(a: EligibleQaPair, b: EligibleQaPair): boolean {
  return jaccard(questionTokens(a), questionTokens(b)) >= NEAR_DUP_THRESHOLD;
}

/** Drop near-duplicate questions (keep earlier sourceOrder). */
export function dedupeNearDuplicatePairs(pairs: EligibleQaPair[]): EligibleQaPair[] {
  const kept: EligibleQaPair[] = [];
  for (const pair of pairs) {
    if (isLowInformationQuestion(pair.publicQuestion)) continue;
    const dup = kept.some((k) => areNearDuplicateQuestions(k, pair));
    if (dup) continue;
    kept.push(pair);
  }
  return kept;
}

function clusterPairs(pairs: EligibleQaPair[]): EligibleQaPair[][] {
  const clusters: EligibleQaPair[][] = [];
  for (const pair of pairs) {
    let bestIdx = -1;
    let bestScore = 0;
    const tokens = pairTokens(pair);
    for (let i = 0; i < clusters.length; i += 1) {
      const centroid = pairTokens(clusters[i]![0]!);
      // compare against cluster mean-ish: max overlap with any member
      let local = 0;
      for (const member of clusters[i]!) {
        local = Math.max(local, jaccard(tokens, pairTokens(member)));
      }
      const seed = jaccard(tokens, centroid);
      const score = Math.max(local, seed);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= CLUSTER_OVERLAP_THRESHOLD) {
      clusters[bestIdx]!.push(pair);
    } else {
      clusters.push([pair]);
    }
  }
  return clusters.sort((a, b) => b.length - a.length);
}

export function scorePairForPath(
  pair: EligibleQaPair,
  prior: EligibleQaPair[]
): number {
  const self = pairTokens(pair);
  if (prior.length === 0) {
    return Math.min(1, self.size / 12);
  }
  const last = prior[prior.length - 1]!;
  const overlap = jaccard(self, pairTokens(last));
  const ansLen = pair.publicAnswer.length;
  const lengthScore =
    ansLen < 40 ? 0.2 : ansLen < 1200 ? 0.55 : ansLen < 4000 ? 0.35 : 0.1;
  return overlap * 0.7 + lengthScore * 0.3;
}

function pathCoherence(pairs: EligibleQaPair[]): number {
  if (pairs.length < 2) return pairs.length === 1 ? 0.2 : 0;
  let total = 0;
  for (let i = 1; i < pairs.length; i += 1) {
    total += jaccard(pairTokens(pairs[i - 1]!), pairTokens(pairs[i]!));
  }
  return total / (pairs.length - 1);
}

/** Always display / freeze in source conversation order. */
export function sortPairsBySourceOrder(pairs: EligibleQaPair[]): EligibleQaPair[] {
  return [...pairs].sort((a, b) => a.sourceOrder - b.sourceOrder);
}

function pickGreedyPath(pairs: EligibleQaPair[], count: number): CandidatePath {
  const remaining = [...pairs];
  const selected: EligibleQaPair[] = [];
  let totalScore = 0;

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i]!;
      if (selected.some((s) => areNearDuplicateQuestions(s, candidate))) continue;
      const s = scorePairForPath(candidate, selected);
      if (s > bestScore + 1e-9 || (Math.abs(s - bestScore) < 1e-9 && i < bestIdx)) {
        bestScore = s;
        bestIdx = i;
      }
    }
    if (bestScore < 0) break;
    const next = remaining.splice(bestIdx, 1)[0]!;
    selected.push(next);
    totalScore += bestScore;
  }

  const ordered = sortPairsBySourceOrder(selected);
  return {
    pathId: `path-${ordered.map((p) => p.userMessageId).join('-').slice(0, 48)}`,
    pairRefs: ordered,
    score: totalScore / Math.max(1, ordered.length),
  };
}

function chronologicalWindow(
  pairs: EligibleQaPair[],
  start: number,
  pathId: string
): CandidatePath | null {
  if (pairs.length < JOURNEY_CANDIDATE_COUNT) return null;
  const maxStart = pairs.length - JOURNEY_CANDIDATE_COUNT;
  const clamped = Math.max(0, Math.min(start, maxStart));
  const slice = sortPairsBySourceOrder(
    pairs.slice(clamped, clamped + JOURNEY_CANDIDATE_COUNT)
  );
  return {
    pathId,
    pairRefs: slice,
    score: pathCoherence(slice),
  };
}

export function proposeCandidatePaths(
  pairs: EligibleQaPair[],
  maxPaths = 3
): Candidate8Result {
  const cleaned = dedupeNearDuplicatePairs(pairs);
  if (cleaned.length < JOURNEY_CANDIDATE_COUNT) {
    return {
      status: 'not_ready',
      pairCount: cleaned.length,
      needed: JOURNEY_CANDIDATE_COUNT,
      reason: 'insufficient_pairs',
    };
  }

  const clusters = clusterPairs(cleaned);
  const dominant = clusters[0] ?? [];
  const second = clusters[1];
  const third = clusters[2];

  // Topic drift: multiple material clusters — do not auto-compress into one journey.
  const materialClusters = clusters.filter((c) => c.length >= 4);
  if (
    materialClusters.length >= 2 &&
    dominant.length < JOURNEY_CANDIDATE_COUNT
  ) {
    return {
      status: 'review_required',
      pairCount: cleaned.length,
      reason: 'insufficient_coherence',
      paths: [],
    };
  }
  if (
    materialClusters.length >= 2 &&
    dominant.length < cleaned.length * 0.55
  ) {
    return {
      status: 'review_required',
      pairCount: cleaned.length,
      reason: 'insufficient_coherence',
      paths: [],
    };
  }

  // Topic drift: largest cluster < 8 and a second cluster is material.
  if (
    dominant.length < JOURNEY_CANDIDATE_COUNT &&
    second &&
    second.length >= 3 &&
    dominant.length < cleaned.length * 0.7
  ) {
    return {
      status: 'review_required',
      pairCount: cleaned.length,
      reason: 'insufficient_coherence',
      paths: [],
    };
  }

  // Three distinct topics each with enough pairs → never auto-pick one 8.
  if (third && second && dominant.length >= 4 && second.length >= 4 && third.length >= 4) {
    return {
      status: 'review_required',
      pairCount: cleaned.length,
      reason: 'insufficient_coherence',
      paths: [],
    };
  }

  const pool =
    dominant.length >= JOURNEY_CANDIDATE_COUNT ? dominant : cleaned;

  const paths: CandidatePath[] = [];
  const primary = pickGreedyPath(pool, JOURNEY_CANDIDATE_COUNT);
  if (primary.pairRefs.length < JOURNEY_CANDIDATE_COUNT) {
    return {
      status: 'not_ready',
      pairCount: cleaned.length,
      needed: JOURNEY_CANDIDATE_COUNT,
      reason: 'insufficient_coherence',
    };
  }

  const coherence = pathCoherence(primary.pairRefs);
  if (coherence < MIN_PATH_COHERENCE && pool === cleaned && clusters.length > 1) {
    return {
      status: 'review_required',
      pairCount: cleaned.length,
      reason: 'insufficient_coherence',
      paths: [{ ...primary, score: coherence }],
    };
  }

  paths.push({ ...primary, score: Math.max(primary.score, coherence) });

  if (maxPaths > 1) {
    const early = chronologicalWindow(pool, 0, 'path-chrono-early');
    if (early && early.pathId !== primary.pathId) paths.push(early);
  }
  if (maxPaths > 2 && pool.length > JOURNEY_CANDIDATE_COUNT) {
    const late = chronologicalWindow(
      pool,
      pool.length - JOURNEY_CANDIDATE_COUNT,
      'path-chrono-late'
    );
    if (late) {
      const dup = paths.some(
        (p) =>
          p.pairRefs.map((x) => x.userMessageId).join() ===
          late.pairRefs.map((x) => x.userMessageId).join()
      );
      if (!dup) paths.push(late);
    }
  }

  return {
    status: 'ready',
    paths: paths.slice(0, maxPaths),
    pairCount: cleaned.length,
  };
}

export function proposeCandidate8(
  messages: JourneyMessageLike[],
  maxPaths = 3
): Candidate8Result {
  return proposeCandidatePaths(extractQaPairs(messages), maxPaths);
}
