/** Mirror Journey Phase 2 PASS — shared types. */

export const JOURNEY_CANDIDATE_COUNT = 8 as const;
export const JOURNEY_SELECTED_MIN = 6 as const;
export const JOURNEY_SELECTED_MAX = 8 as const;
export const REVIEW8_DRAFT_STORAGE_KEY = 'eza_mirror_review8_draft_v2';
/** Mirrors backend EZA_MIRROR_JOURNEY_V1 for client UX (default off). */
export const MIRROR_JOURNEY_CLIENT_FLAG = 'NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1';

export type JourneyMessageRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool'
  | 'noise'
  | 'unknown';

/** Minimal message shape — archive or live chat. */
export type JourneyMessageLike = {
  id: string;
  text: string;
  /** Legacy boolean; prefer `role` when present. */
  isUser?: boolean;
  role?: JourneyMessageRole;
  /** Streaming / incomplete assistant — not eligible. */
  incomplete?: boolean;
  /** Explicit regenerate supersedes earlier assistant id when set. */
  replacesAssistantMessageId?: string;
};

export type EligibleQaPair = {
  userMessageId: string;
  assistantMessageId: string;
  publicQuestion: string;
  publicAnswer: string;
  /** Chronological source order (0-based among extracted pairs). */
  sourceOrder: number;
};

export type Review8StepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Review8SelectedStep = EligibleQaPair & {
  index: Review8StepIndex;
};

export type CandidatePath = {
  pathId: string;
  pairRefs: EligibleQaPair[];
  /** Lexical coherence score (higher = better progression). */
  score: number;
  topicLabel?: string;
};

export type Candidate8Result =
  | { status: 'ready'; paths: CandidatePath[]; pairCount: number }
  | {
      status: 'not_ready';
      pairCount: number;
      needed: typeof JOURNEY_CANDIDATE_COUNT;
      reason?: 'insufficient_pairs' | 'insufficient_coherence';
    }
  | {
      status: 'review_required';
      pairCount: number;
      reason: 'insufficient_coherence';
      paths: CandidatePath[];
    };

export type Review8DraftStatus = 'proposing' | 'reviewing' | 'confirmed';

export type Review8Draft = {
  /** Owner scope — never share across users. */
  ownerUserId: string;
  draftKey: string;
  sourceConversationId: string;
  /** Public journey identity (= network slug when published). Allocated on confirm. */
  journeyId: string | null;
  /**
   * Confirmed selected steps (6–8). During reviewing, may also hold the full
   * source-block selection before deselection is applied.
   */
  selectedSteps: Review8SelectedStep[];
  /**
   * Full source block of 8 (always). Selection is a subset; deselected pairs
   * remain here for sourceBlockHash and never enter scoped D2 after confirm.
   */
  sourceBlockSteps?: EligibleQaPair[];
  /** Selected sourceOrders inside the source block (during review). */
  selectedSourceOrders?: number[];
  status: Review8DraftStatus;
  updatedAt: string;
  titleSeed?: string;
  /** Set on confirm — integrity check for restore (selected package). */
  snapshotHash?: string | null;
  /** Deterministic source-block identity (product model). */
  windowIndex?: number;
  windowStartSequence?: number;
  windowEndSequence?: number;
  parentJourneyId?: string | null;
  /** Authoritative journey version for prepare/publish lineage (default 1). */
  journeyVersion?: number;
  sourceBlockHash?: string | null;
  selectedStepsHash?: string | null;
};
