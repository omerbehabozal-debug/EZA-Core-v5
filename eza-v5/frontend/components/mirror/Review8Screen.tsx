'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  buildReview8DraftFromWindow,
  confirmReview8Draft,
  JOURNEY_CANDIDATE_COUNT,
  saveReview8Draft,
  type EligibleQaPair,
  type Review8Draft,
} from '@/lib/eza/mirror/journey';

export type Review8ScreenProps = {
  ownerUserId: string;
  sourceConversationId: string;
  /** Exact chronological window pairs (length 8). */
  windowPairs: EligibleQaPair[];
  windowIndex: number;
  draftKey: string;
  parentJourneyId?: string | null;
  titleSeed?: string;
  initialDraft?: Review8Draft | null;
  onConfirmed: (draft: Review8Draft) => void;
  onCancel: () => void;
  className?: string;
};

/**
 * Review 8 — publication/privacy consent for one deterministic window.
 * Not a semantic selector: no Candidate 8, no reordering, no cross-window mixing.
 */
export default function Review8Screen({
  ownerUserId,
  sourceConversationId,
  windowPairs,
  windowIndex,
  draftKey,
  parentJourneyId = null,
  titleSeed,
  initialDraft,
  onConfirmed,
  onCancel,
  className,
}: Review8ScreenProps) {
  const [draft, setDraft] = useState<Review8Draft | null>(() => {
    if (
      initialDraft?.ownerUserId === ownerUserId &&
      initialDraft.draftKey === draftKey &&
      initialDraft.selectedSteps?.length === JOURNEY_CANDIDATE_COUNT
    ) {
      return { ...initialDraft, status: 'reviewing', snapshotHash: null };
    }
    if (windowPairs.length !== JOURNEY_CANDIDATE_COUNT) return null;
    return buildReview8DraftFromWindow({
      ownerUserId,
      sourceConversationId,
      windowIndex,
      pairs: windowPairs,
      draftKey,
      parentJourneyId,
      titleSeed,
    });
  });
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (!draft || windowPairs.length !== JOURNEY_CANDIDATE_COUNT) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[85] flex items-end justify-center bg-black/55 p-4 sm:items-center',
          className
        )}
        role="dialog"
        aria-modal="true"
        data-testid="review8-invalid-window"
      >
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141210] p-5 text-[#f4f0e8]">
          <p className="text-sm">Bu Yansı henüz 8 geçerli adım içermiyor.</p>
          <button
            type="button"
            className="mt-4 w-full rounded-full border border-white/10 py-2.5 text-xs"
            onClick={onCancel}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    const result = confirmReview8Draft(draft);
    if (!result.ok) {
      setConfirmError(result.message);
      return;
    }
    saveReview8Draft(result.draft);
    onConfirmed(result.draft);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[85] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review8-title"
      data-testid="review8-screen"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141210] text-[#f4f0e8] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <h2 id="review8-title" className="text-base font-semibold tracking-tight">
            8 soruyu gözden geçir
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[rgba(246,244,239,0.65)]">
            Bu Yansı, sohbetindeki bu 8 soru-cevaptan oluşur. Onay yayın kararıdır; sorular
            yeniden seçilmez.
          </p>
        </header>

        <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {draft.selectedSteps.map((step) => (
            <li
              key={`${step.index}-${step.userMessageId}`}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
              data-testid={`review8-step-${step.index}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(231,180,91,0.85)]">
                {step.index} / 8
              </span>
              <p className="mt-1 text-sm font-medium leading-snug">{step.publicQuestion}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[rgba(246,244,239,0.62)]">
                {step.publicAnswer.length > 280
                  ? `${step.publicAnswer.slice(0, 280)}…`
                  : step.publicAnswer}
              </p>
            </li>
          ))}
        </ol>

        {confirmError ? (
          <p className="px-4 text-xs text-[#f0b4a0]" data-testid="review8-confirm-error">
            {confirmError}
          </p>
        ) : null}

        <footer className="flex flex-col gap-2 border-t border-white/10 px-4 py-4">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(231,180,91,0.42)] bg-[linear-gradient(165deg,rgba(231,180,91,0.28)_0%,rgba(231,180,91,0.14)_100%)] px-4 py-2.5 text-xs font-semibold text-[#f6f0e4]"
            onClick={handleConfirm}
            data-testid="review8-confirm"
          >
            Bu 8 soruyu onayla
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-xs font-medium text-[rgba(217,196,163,0.85)]"
            onClick={onCancel}
            data-testid="review8-cancel"
          >
            İptal
          </button>
        </footer>
      </div>
    </div>
  );
}
