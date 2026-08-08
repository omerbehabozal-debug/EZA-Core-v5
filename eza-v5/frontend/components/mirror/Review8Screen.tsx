'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  buildReview8Draft,
  confirmReview8Draft,
  extractQaPairs,
  JOURNEY_CANDIDATE_COUNT,
  proposeCandidate8,
  replaceReview8Step,
  saveReview8Draft,
  type CandidatePath,
  type EligibleQaPair,
  type JourneyMessageLike,
  type Review8Draft,
  type Review8StepIndex,
} from '@/lib/eza/mirror/journey';

export type Review8ScreenProps = {
  sourceConversationId: string;
  messages: JourneyMessageLike[];
  titleSeed?: string;
  initialDraft?: Review8Draft | null;
  onConfirmed: (draft: Review8Draft) => void;
  onCancel: () => void;
  className?: string;
};

export default function Review8Screen({
  sourceConversationId,
  messages,
  titleSeed,
  initialDraft,
  onConfirmed,
  onCancel,
  className,
}: Review8ScreenProps) {
  const candidateResult = useMemo(() => proposeCandidate8(messages), [messages]);
  const allPairs = useMemo(() => extractQaPairs(messages), [messages]);

  const [path, setPath] = useState<CandidatePath | null>(() =>
    candidateResult.status === 'ready' ? candidateResult.paths[0] ?? null : null
  );
  const [draft, setDraft] = useState<Review8Draft | null>(() => {
    if (initialDraft?.selectedSteps?.length === JOURNEY_CANDIDATE_COUNT) {
      return initialDraft;
    }
    if (candidateResult.status === 'ready' && candidateResult.paths[0]) {
      return buildReview8Draft({
        sourceConversationId,
        path: candidateResult.paths[0],
        titleSeed,
      });
    }
    return null;
  });
  const [replaceIndex, setReplaceIndex] = useState<Review8StepIndex | null>(null);

  const unusedPairs = useMemo(() => {
    if (!draft) return allPairs;
    const used = new Set(draft.selectedSteps.map((s) => s.userMessageId));
    return allPairs.filter((p) => !used.has(p.userMessageId));
  }, [allPairs, draft]);

  if (candidateResult.status === 'not_ready') {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[85] flex items-end justify-center bg-black/55 p-4 sm:items-center',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review8-not-ready-title"
        data-testid="review8-not-ready"
      >
        <div
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141210] p-5 text-[#f4f0e8] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="review8-not-ready-title" className="text-base font-semibold">
            Henüz 8 soruluk yol yok
          </h2>
          <p className="mt-2 text-sm text-[rgba(246,244,239,0.75)]">
            Bu sohbette {candidateResult.pairCount} uygun soru-cevap çifti var. Yansı için en az{' '}
            {candidateResult.needed} çift gerekir.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-xs font-medium"
            onClick={onCancel}
            data-testid="review8-not-ready-close"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  if (!draft || !path) {
    return null;
  }

  const selectPath = (next: CandidatePath) => {
    setPath(next);
    setDraft(
      buildReview8Draft({
        sourceConversationId,
        path: next,
        titleSeed,
      })
    );
    setReplaceIndex(null);
  };

  const applyReplace = (pair: EligibleQaPair) => {
    if (replaceIndex == null) return;
    setDraft((prev) => (prev ? replaceReview8Step(prev, replaceIndex, pair) : prev));
    setReplaceIndex(null);
  };

  const handleConfirm = () => {
    const confirmed = confirmReview8Draft(draft);
    saveReview8Draft(confirmed);
    onConfirmed(confirmed);
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
            Yayımlanacak merak yolculuğu bu 8 soru-cevaptan oluşur. Onaydan sonra görsel ve anlam
            yalnızca bunlara bakacak.
          </p>
        </header>

        {candidateResult.paths.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-white/5 px-4 py-2">
            {candidateResult.paths.map((p, i) => (
              <button
                key={p.pathId}
                type="button"
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-[11px]',
                  path.pathId === p.pathId
                    ? 'border-[rgba(231,180,91,0.5)] bg-[rgba(231,180,91,0.18)] text-[#f6f0e4]'
                    : 'border-white/10 text-[rgba(217,196,163,0.8)]'
                )}
                onClick={() => selectPath(p)}
                data-testid={`review8-path-${i}`}
              >
                Yol {i + 1}
              </button>
            ))}
          </div>
        ) : null}

        <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {draft.selectedSteps.map((step) => (
            <li
              key={`${step.index}-${step.userMessageId}`}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
              data-testid={`review8-step-${step.index}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(231,180,91,0.85)]">
                  {step.index} / 8
                </span>
                <button
                  type="button"
                  className="text-[10px] text-[rgba(217,196,163,0.75)] underline-offset-2 hover:underline"
                  onClick={() => setReplaceIndex(step.index)}
                  data-testid={`review8-replace-${step.index}`}
                >
                  Değiştir
                </button>
              </div>
              <p className="text-sm font-medium leading-snug">{step.publicQuestion}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[rgba(246,244,239,0.62)]">
                {step.publicAnswer.length > 280
                  ? `${step.publicAnswer.slice(0, 280)}…`
                  : step.publicAnswer}
              </p>
            </li>
          ))}
        </ol>

        {replaceIndex != null ? (
          <div
            className="border-t border-white/10 bg-black/30 px-4 py-3"
            data-testid="review8-replace-panel"
          >
            <p className="mb-2 text-xs text-[rgba(246,244,239,0.7)]">
              Adım {replaceIndex} için alternatif çift seç
            </p>
            {unusedPairs.length === 0 ? (
              <p className="text-xs text-[rgba(246,244,239,0.5)]">Başka uygun çift yok.</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {unusedPairs.slice(0, 12).map((pair) => (
                  <li key={pair.userMessageId}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs hover:border-[rgba(231,180,91,0.35)]"
                      onClick={() => applyReplace(pair)}
                    >
                      {pair.publicQuestion.slice(0, 120)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-2 text-[11px] text-[rgba(217,196,163,0.7)]"
              onClick={() => setReplaceIndex(null)}
            >
              Vazgeç
            </button>
          </div>
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
