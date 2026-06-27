import type { MirrorBirthEvaluation } from '@/lib/eza/mirror-birth/mirrorBirthPolicy';

type Listener = () => void;

let latestEvaluation: MirrorBirthEvaluation | null = null;
const listeners = new Set<Listener>();

export function setMirrorBirthDebugState(evaluation: MirrorBirthEvaluation | null): void {
  latestEvaluation = evaluation;
  listeners.forEach((listener) => listener());
}

export function getMirrorBirthDebugState(): MirrorBirthEvaluation | null {
  return latestEvaluation;
}

export function subscribeMirrorBirthDebug(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
