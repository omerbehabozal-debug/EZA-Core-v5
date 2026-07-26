/**
 * Stage 2A — public API response shape (full payload from backend).
 * Landing UI must use pickMirrorLandingSurface() — never render all fields.
 */

export type MirrorNetworkPublicApiResponse = {
  slug: string;
  shareUrl: string;
  cardTitle: string;
  cardDate: string;
  sceneImageUrl?: string | null;
  coreCuriosity: string;
  curiosityContext: string;
  landingContext: string;
  hooks?: string[];
  seedQuestions?: string[];
  discoverySignals?: string[];
  collectionTags?: string[];
  seed?: Record<string, unknown>;
  lineage?: string | null;
  shareVoice?: string | null;
  publicTitle?: string | null;
  publicSummary?: string | null;
  continuationContext?: string | null;
  contractVersion?: string | null;
  interpretationHash?: string | null;
  publicLandingHash?: string | null;
  semanticSource?: string | null;
};

/**
 * Landing surface — title + public summary only.
 * continuationContext is intentionally omitted from UI.
 */
export type MirrorLandingSurface = {
  slug: string;
  cardTitle: string;
  cardDate: string;
  dayLabel: string;
  sceneImageUrl: string | null;
  curiosityContext: string;
  publicSummary?: string;
};
