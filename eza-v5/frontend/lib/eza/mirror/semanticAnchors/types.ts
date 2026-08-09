/**
 * Mirror V6 — Semantic Anchors.
 *
 * Meaning core for Curiosity Builder (and later prompt / vision match).
 * Built from D2 interpretation + D1 user_stated evidence — not V3 labels.
 */

export const MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION =
  'mirror-semantic-anchors-v1' as const;

export type MirrorSemanticAnchorsV1 = {
  contractVersion: typeof MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION;
  /** Primary place / setting when grounded (e.g. Mardin). */
  place: string | null;
  /** Concrete scene props / moments. */
  scene: string[];
  /** Felt atmosphere / emotional texture. */
  emotion: string[];
  /** What the conversation is about (topic core). */
  topic: string | null;
  /** User's real problem / intent. */
  userIntent: string | null;
  /** What will decide the outcome. */
  decisionCriteria: string[];
  /** Open question that creates click desire. */
  question: string | null;
  /** Sync fingerprint of the normalized anchor set. */
  anchorsHash: string;
  /** How many user_stated evidence strings contributed. */
  evidenceCount: number;
  /** Phase 3 Journey V1 provenance — not semantic content. */
  anchorsScope?: 'journey_window_v1';
  journeyId?: string;
  windowHash?: string;
};

export type SemanticAnchorEvidenceItem = {
  text: string;
  epistemic?: string | null;
  kind?: string | null;
  speaker?: string | null;
};

export type BuildSemanticAnchorsInput = {
  interpretation: {
    title?: string | null;
    interpretationSummary?: string | null;
    imageIntent?: string | null;
    visualNarrative?: string | null;
    atmosphereHint?: string | null;
    topicCategory?: string | null;
  };
  /** D1 factualGrounding / salientDetails — prefer user_stated. */
  evidence?: ReadonlyArray<SemanticAnchorEvidenceItem> | null;
  locale?: string | null;
  /** Journey V1 provenance stamped onto anchors (does not affect hash). */
  journeyProvenance?: {
    journeyId: string;
    windowHash: string;
  } | null;
};
