/** Mirror Journey Phase 2 — shared types (Review 8 / Candidate 8). */

export const JOURNEY_CANDIDATE_COUNT = 8 as const;
export const REVIEW8_DRAFT_STORAGE_KEY = 'eza_mirror_review8_draft';
/** Mirrors backend EZA_MIRROR_JOURNEY_V1 for client UX (default off). */
export const MIRROR_JOURNEY_CLIENT_FLAG = 'NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1';

/** Minimal message shape — archive or live chat. */
export type JourneyMessageLike = {
  id: string;
  text: string;
  isUser: boolean;
};

export type EligibleQaPair = {
  userMessageId: string;
  assistantMessageId: string;
  publicQuestion: string;
  publicAnswer: string;
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
};

export type Candidate8Result =
  | { status: 'ready'; paths: CandidatePath[]; pairCount: number }
  | { status: 'not_ready'; pairCount: number; needed: typeof JOURNEY_CANDIDATE_COUNT };

export type Review8DraftStatus = 'proposing' | 'reviewing' | 'confirmed';

export type Review8Draft = {
  draftKey: string;
  sourceConversationId: string;
  /** Public journey identity (= network slug when published). Allocated on confirm. */
  journeyId: string | null;
  selectedSteps: Review8SelectedStep[];
  status: Review8DraftStatus;
  updatedAt: string;
  /** Optional display seed for slug allocation. */
  titleSeed?: string;
};
