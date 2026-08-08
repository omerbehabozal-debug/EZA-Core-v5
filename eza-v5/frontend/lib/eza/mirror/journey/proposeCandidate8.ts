/**
 * Candidate 8 — propose exactly 8 Q/A pairs as a coherent path.
 * Lexical / progression heuristic (no LLM). RFC §4.3.
 */

import { extractQaPairs } from './extractQaPairs';
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
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Score how well a pair continues a running path (lexical overlap + length balance). */
export function scorePairForPath(
  pair: EligibleQaPair,
  prior: EligibleQaPair[]
): number {
  const qTokens = tokenize(pair.publicQuestion);
  const aTokens = tokenize(pair.publicAnswer);
  const self = new Set([...qTokens, ...aTokens]);

  if (prior.length === 0) {
    // Prefer substantive openers
    return Math.min(1, (qTokens.size + aTokens.size) / 12);
  }

  const last = prior[prior.length - 1]!;
  const lastTokens = new Set([
    ...tokenize(last.publicQuestion),
    ...tokenize(last.publicAnswer),
  ]);
  const overlap = jaccard(self, lastTokens);

  // Mild preference for moderate answer length (not empty spam, not novelas).
  const ansLen = pair.publicAnswer.length;
  const lengthScore =
    ansLen < 40 ? 0.2 : ansLen < 1200 ? 0.55 : ansLen < 4000 ? 0.35 : 0.1;

  return overlap * 0.7 + lengthScore * 0.3;
}

function pickGreedyPath(pairs: EligibleQaPair[], count: number): CandidatePath {
  const remaining = [...pairs];
  const selected: EligibleQaPair[] = [];
  let totalScore = 0;

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const s = scorePairForPath(remaining[i]!, selected);
      // Prefer chronological when scores tie — earlier index in original order.
      if (s > bestScore + 1e-9 || (Math.abs(s - bestScore) < 1e-9 && i < bestIdx)) {
        bestScore = s;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    selected.push(next);
    totalScore += bestScore;
  }

  return {
    pathId: `path-primary-${selected.map((p) => p.userMessageId).join('-').slice(0, 48)}`,
    pairRefs: selected,
    score: totalScore / Math.max(1, selected.length),
  };
}

/**
 * Alternate path: chronological windows (early / mid / late) when enough pairs.
 */
function chronologicalWindow(
  pairs: EligibleQaPair[],
  start: number,
  pathId: string
): CandidatePath | null {
  if (pairs.length < JOURNEY_CANDIDATE_COUNT) return null;
  const maxStart = pairs.length - JOURNEY_CANDIDATE_COUNT;
  const clamped = Math.max(0, Math.min(start, maxStart));
  const slice = pairs.slice(clamped, clamped + JOURNEY_CANDIDATE_COUNT);
  let score = 0;
  for (let i = 0; i < slice.length; i += 1) {
    score += scorePairForPath(slice[i]!, slice.slice(0, i));
  }
  return {
    pathId,
    pairRefs: slice,
    score: score / JOURNEY_CANDIDATE_COUNT,
  };
}

export function proposeCandidatePaths(
  pairs: EligibleQaPair[],
  maxPaths = 3
): Candidate8Result {
  if (pairs.length < JOURNEY_CANDIDATE_COUNT) {
    return {
      status: 'not_ready',
      pairCount: pairs.length,
      needed: JOURNEY_CANDIDATE_COUNT,
    };
  }

  const paths: CandidatePath[] = [];
  const primary = pickGreedyPath(pairs, JOURNEY_CANDIDATE_COUNT);
  paths.push(primary);

  if (maxPaths > 1) {
    const early = chronologicalWindow(pairs, 0, 'path-chrono-early');
    if (early && early.pathId !== primary.pathId) paths.push(early);
  }
  if (maxPaths > 2 && pairs.length > JOURNEY_CANDIDATE_COUNT) {
    const lateStart = pairs.length - JOURNEY_CANDIDATE_COUNT;
    const late = chronologicalWindow(pairs, lateStart, 'path-chrono-late');
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
    pairCount: pairs.length,
  };
}

export function proposeCandidate8(
  messages: JourneyMessageLike[],
  maxPaths = 3
): Candidate8Result {
  return proposeCandidatePaths(extractQaPairs(messages), maxPaths);
}
