'use client';

import { X } from 'lucide-react';
import MirrorThoughtCardButton from '@/components/mirror-landing/MirrorThoughtCard';
import { cn } from '@/lib/utils';

export type MirrorBranchSuggestionProps = {
  cards: string[];
  onSelect: (title: string) => void;
  onDismiss: () => void;
  className?: string;
};

/**
 * Calm inactivity block — no "seed" or "branch" product language.
 */
export default function MirrorBranchSuggestion({
  cards,
  onSelect,
  onDismiss,
  className,
}: MirrorBranchSuggestionProps) {
  return (
    <div
      className={cn(
        'mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-[#e8d5b5]/15 bg-[#141210]/90 p-4 text-[#e8dfd0]',
        className
      )}
      data-testid="mirror-branch-suggestion"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#f4f0e8]">
            Bu merak burada güzel bir yere geldi.
          </p>
          <p className="mt-1 text-sm text-[#a89f92]">
            İstersen aynı konunun farklı bir kolundan yeni bir sohbet başlatabilirsin.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[#8a8074] hover:bg-white/5 hover:text-[#e8dfd0]"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {cards.map((label, index) => (
          <MirrorThoughtCardButton
            key={`${label}-${index}`}
            card={{ id: `branch-card-${index}`, label }}
            onSelect={() => onSelect(label)}
          />
        ))}
      </div>
    </div>
  );
}
