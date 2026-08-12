'use client';

/**
 * Phase 5.1 — lightweight sheet of alternate direct child Yansılar.
 */

import { useEffect } from 'react';
import type { EligibleChildContinuation } from '@/lib/eza/mirror/journey/yansiChildContinuation';
import { cn } from '@/lib/utils';

export type MirrorAlternateChildrenSheetProps = {
  open: boolean;
  onClose: () => void;
  alternatives: EligibleChildContinuation[];
  onSelect: (child: EligibleChildContinuation) => void;
};

export default function MirrorAlternateChildrenSheet({
  open,
  onClose,
  alternatives,
  onSelect,
}: MirrorAlternateChildrenSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Diğer yollar"
      data-testid="mirror-alternate-children-sheet"
      onClick={onClose}
    >
      <div
        className={cn(
          'max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10',
          'bg-[#141210] p-4 text-[#f4f0e8] shadow-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide">Diğer yollar</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-xs text-[#c9bba8] hover:bg-white/5"
            data-testid="mirror-alternate-children-close"
          >
            Kapat
          </button>
        </div>
        <ul className="space-y-2">
          {alternatives.map((child) => (
            <li key={child.artifact.slug}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]"
                onClick={() => onSelect(child)}
                data-testid={`mirror-alternate-child-${child.artifact.slug}`}
              >
                <span className="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-white/5">
                  {child.meta.sceneImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={child.meta.sceneImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {child.artifact.publicTitle || child.meta.publicTitle}
                  </span>
                  {child.artifact.publicSummary || child.meta.publicSummary ? (
                    <span className="mt-0.5 line-clamp-2 block text-[11px] text-[#a89880]">
                      {child.artifact.publicSummary || child.meta.publicSummary}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
