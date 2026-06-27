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
};

/**
 * Stage 2A landing surface — only fields allowed on /m/[slug].
 * hooks, seedQuestions, tags, coreCuriosity intentionally omitted.
 */
export type MirrorLandingSurface = {
  slug: string;
  cardTitle: string;
  cardDate: string;
  dayLabel: string;
  sceneImageUrl: string | null;
  curiosityContext: string;
};
