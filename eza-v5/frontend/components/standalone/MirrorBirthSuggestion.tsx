'use client';

import { X } from 'lucide-react';
import {
  MIRROR_BIRTH_DISMISS_LABEL,
  MIRROR_BIRTH_SUGGESTION_BODY,
  MIRROR_BIRTH_SUGGESTION_CTA,
  MIRROR_BIRTH_SUGGESTION_TITLE,
} from '@/lib/eza/mirror-birth/mirrorBirthCopy';
import { cn } from '@/lib/utils';

export type MirrorBirthSuggestionProps = {
  onAccept: () => void;
  onDismiss: () => void;
  className?: string;
};

/**
 * Calm editorial mirror birth card — not a popup, badge, or task completion UI.
 */
export default function MirrorBirthSuggestion({
  onAccept,
  onDismiss,
  className,
}: MirrorBirthSuggestionProps) {
  return (
    <div
      className={cn(
        'saina-mirror-birth-card mx-auto mt-4 w-full max-w-2xl rounded-2xl border border-[#d8c4a0]/20 bg-[#12100e]/85 px-4 py-4 text-[#ebe4d8]',
        className
      )}
      data-testid="mirror-birth-suggestion"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#f4f0e8]">{MIRROR_BIRTH_SUGGESTION_TITLE}</p>
          <p className="mt-1 text-sm text-[#a89f92]">{MIRROR_BIRTH_SUGGESTION_BODY}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[#8a8074] hover:bg-white/5 hover:text-[#e8dfd0]"
          aria-label={MIRROR_BIRTH_DISMISS_LABEL}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex items-center justify-center rounded-full border border-[#d8b16a]/35 bg-[#05483a]/90 px-5 py-2 text-sm font-medium text-[#eee8da] transition-colors hover:bg-[#05483a]"
          data-testid="mirror-birth-accept"
        >
          {MIRROR_BIRTH_SUGGESTION_CTA}
        </button>
      </div>
    </div>
  );
}
