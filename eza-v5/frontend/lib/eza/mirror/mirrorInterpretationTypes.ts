/**
 * Frontend mirror of backend MirrorInterpretationV1 (PR D2).
 * Creative authority for scene intent — not a rendering recipe.
 */

export const MIRROR_INTERPRETATION_SCHEMA_VERSION = 'mirror-interpretation-v1' as const;

export type MirrorInterpretationV1 = {
  version?: typeof MIRROR_INTERPRETATION_SCHEMA_VERSION | string;
  title: string;
  interpretationSummary: string;
  rationale: string;
  imageIntent: string;
  visualNarrative: string;
  exclusions?: string[];
  confidence?: number;
  topicCategory?: string | null;
  atmosphereHint?: string | null;
};

export function isMirrorInterpretationV1(value: unknown): value is MirrorInterpretationV1 {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.title === 'string' &&
    row.title.trim().length >= 2 &&
    typeof row.interpretationSummary === 'string' &&
    row.interpretationSummary.trim().length >= 8 &&
    typeof row.imageIntent === 'string' &&
    row.imageIntent.trim().length >= 8 &&
    typeof row.visualNarrative === 'string' &&
    row.visualNarrative.trim().length >= 24
  );
}
