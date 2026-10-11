import { buildApiUrl } from '@/lib/apiUrl';
import type { PublicFrozenJourneyArtifact } from './journey/publicFrozenTypes';

export type EditorialBlock = { type: 'markdown' | 'sectionHeading'; startOffset: number; endOffset: number; displayNumber?: string | null };
export type EditorialStep = { stepIndex: number; questionHash: string; answerHash: string; blocks: EditorialBlock[] };
export type EditorialVersion = { slug: string; journeyVersion: number; language: 'und'; templateVersion: 1; sourceHash: string; offsetEncoding: 'utf-16'; status: 'ready'; steps: EditorialStep[] };

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function editorialSourceHash(artifact: PublicFrozenJourneyArtifact): Promise<string> {
  // Canonical sorted keys match the backend's public-only identity exactly.
  return hash(JSON.stringify({ publicTitle: artifact.publicTitle ?? null, steps: artifact.steps.map((step) => ({
    publicAnswer: step.publicAnswer, publicQuestion: step.publicQuestion, stepIndex: step.stepIndex,
  })) }));
}

export async function validateEditorial(raw: unknown, artifact: PublicFrozenJourneyArtifact): Promise<EditorialVersion | null> {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as EditorialVersion;
  if (value.status !== 'ready' || value.slug !== artifact.slug || value.journeyVersion !== artifact.journeyVersion ||
      value.language !== 'und' || value.templateVersion !== 1 || value.offsetEncoding !== 'utf-16' ||
      value.sourceHash !== await editorialSourceHash(artifact) || !Array.isArray(value.steps) || value.steps.length !== artifact.steps.length) return null;
  for (let i = 0; i < artifact.steps.length; i++) {
    const source = artifact.steps[i]; const step = value.steps[i];
    if (!step || step.stepIndex !== source.stepIndex || step.questionHash !== await hash(source.publicQuestion) ||
        step.answerHash !== await hash(source.publicAnswer) || !Array.isArray(step.blocks)) return null;
    let offset = 0; let section = 0;
    for (const block of step.blocks) {
      if (!block || !Number.isInteger(block.startOffset) || !Number.isInteger(block.endOffset) ||
          block.startOffset !== offset || block.endOffset <= offset || block.endOffset > source.publicAnswer.length ||
          (block.type !== 'markdown' && block.type !== 'sectionHeading')) return null;
      // Do not split Unicode surrogate pairs.
      if (block.endOffset < source.publicAnswer.length && /[\uD800-\uDBFF]/.test(source.publicAnswer[block.endOffset - 1]) && /[\uDC00-\uDFFF]/.test(source.publicAnswer[block.endOffset])) return null;
      if (block.type === 'sectionHeading') {
        section++;
        if (block.displayNumber !== String(section).padStart(2, '0') || !/^ {0,3}#{1,6}[\t ]+\S/.test(source.publicAnswer.slice(offset, block.endOffset))) return null;
      }
      offset = block.endOffset;
    }
    if (offset !== source.publicAnswer.length) return null;
  }
  // Allowlist: never retain arbitrary response/private fields in replay state.
  return { slug: value.slug, journeyVersion: value.journeyVersion, language: 'und', templateVersion: 1,
    sourceHash: value.sourceHash, offsetEncoding: 'utf-16', status: 'ready', steps: value.steps.map((step) => ({
      stepIndex: step.stepIndex, questionHash: step.questionHash, answerHash: step.answerHash,
      blocks: step.blocks.map((block) => ({ type: block.type, startOffset: block.startOffset, endOffset: block.endOffset,
        ...(block.type === 'sectionHeading' ? { displayNumber: block.displayNumber } : {}) })),
    })) };
}

const requests = new Map<string, { expires: number; promise: Promise<EditorialVersion | null> }>();
export async function fetchYansiEditorial(artifact: PublicFrozenJourneyArtifact): Promise<EditorialVersion | null> {
  try {
    const key = `${artifact.slug}:${artifact.journeyVersion}:und:1:${await editorialSourceHash(artifact)}`;
    const hit = requests.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = (async () => {
      const response = await fetch(buildApiUrl(`/api/mirror-network/${encodeURIComponent(artifact.slug)}/editorial?journeyVersion=${artifact.journeyVersion}`),
        { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
      return response.ok ? validateEditorial(await response.json(), artifact) : null;
    })().catch(() => null);
    if (requests.size >= 64) requests.delete(requests.keys().next().value!);
    requests.set(key, { expires: Date.now() + 30000, promise });
    return promise;
  } catch { return null; }
}
