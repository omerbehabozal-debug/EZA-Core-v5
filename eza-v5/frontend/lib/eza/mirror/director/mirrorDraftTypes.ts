/**
 * Mirror Draft + Director Review types — frontend contract mirror of
 * backend/core/schemas/mirror_draft.py (PR B).
 *
 * Production create-path does NOT call Director yet.
 * Title authority when LLM draft is final: finalDraft.title must not be
 * overwritten by heuristic title pools (PR C wiring rule).
 */

export const MIRROR_DRAFT_SCHEMA_VERSION = 'mirror-draft-v1' as const;
export const MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION = 'mirror-director-review-v1' as const;

export type MirrorArtDirectionId =
  | 'bright_cinematic'
  | 'night_discovery'
  | 'editorial_magazine'
  | 'film_poster'
  | 'quiet_luxury'
  | 'golden_hour';

export const MIRROR_ART_DIRECTION_IDS: readonly MirrorArtDirectionId[] = [
  'bright_cinematic',
  'night_discovery',
  'editorial_magazine',
  'film_poster',
  'quiet_luxury',
  'golden_hour',
] as const;

export type MirrorNarrativeAngle =
  | 'unexpected_discovery'
  | 'quiet_transformation'
  | 'earned_confidence'
  | 'playful_curiosity'
  | 'architectural_precision'
  | 'personal_milestone'
  | 'adaptive_plan'
  | 'reflective_pause'
  | 'other';

export type DirectorDecision = 'approve' | 'revise';

export type DirectorReasonCode =
  | 'topic_mismatch'
  | 'narrative_mismatch'
  | 'generic_title'
  | 'unsupported_motif'
  | 'forbidden_symbol_conflict'
  | 'cliche_representation'
  | 'weak_scene_specificity'
  | 'emotional_tone_mismatch'
  | 'art_direction_mismatch'
  | 'composition_problem'
  | 'unsafe_or_disallowed_content'
  | 'schema_quality_issue'
  | 'other';

export type DraftSource =
  | 'llm_draft_approved'
  | 'llm_draft_revised'
  | 'heuristic_draft'
  | 'safe_fallback'
  | 'interpretation_llm'
  | 'interpretation_heuristic';

export type MirrorDraftEvidenceMap = {
  titleEvidence: string[];
  motifEvidence: string[];
  narrativeEvidence: string[];
};

export type MirrorDraftV1 = {
  schemaVersion: typeof MIRROR_DRAFT_SCHEMA_VERSION;
  title: string;
  subtitle: string | null;
  coreIdea: string;
  narrativeAngle: MirrorNarrativeAngle;
  artDirection: MirrorArtDirectionId;
  sceneDescription: string;
  visualMotifs: string[];
  forbiddenSymbols: string[];
  palette: string[];
  composition: string;
  lighting: string;
  camera: string;
  typographyMood: string;
  emotionalTone: string[];
  topicCategory: string;
  confidence: number;
  evidence?: MirrorDraftEvidenceMap | null;
};

export type MirrorDirectorReviewV1 = {
  schemaVersion: typeof MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION;
  decision: DirectorDecision;
  overallScore: number;
  reasonCodes: DirectorReasonCode[];
  summary: string;
  requiredChanges: string[];
  revisedDraft: MirrorDraftV1 | null;
  confidence: number;
};

/** Planned PR C persist contract — not written yet. */
export type MirrorDirectorMetadataContract = {
  analysisSchemaVersion: string;
  draftSchemaVersion: string;
  reviewSchemaVersion: string;
  analysisSource: string;
  draftSource: DraftSource;
  analysisConfidence?: number | null;
  draftConfidence?: number | null;
  directorConfidence?: number | null;
  directorDecision?: DirectorDecision | null;
  directorReasonCodes: DirectorReasonCode[];
  revisionCount: 0 | 1;
  fallbackReason?: string | null;
  topicCategory: string;
  draftDurationMs?: number | null;
  reviewDurationMs?: number | null;
  totalDirectorDurationMs?: number | null;
  contentHash: string;
  draftModel?: string | null;
  reviewModel?: string | null;
  /** PR C — which system owned the final title. */
  titleSource?: string | null;
  /** PR C rollout mode fields */
  directorMode?: string | null;
  directorExecuted?: boolean | null;
  directorAffectedOutput?: boolean | null;
  promptSource?: string | null;
};

/** Required draft field names — parity fixture with Python schema. */
export const MIRROR_DRAFT_REQUIRED_FIELDS = [
  'schemaVersion',
  'title',
  'coreIdea',
  'narrativeAngle',
  'artDirection',
  'sceneDescription',
  'composition',
  'lighting',
  'camera',
  'typographyMood',
  'topicCategory',
  'confidence',
] as const;
