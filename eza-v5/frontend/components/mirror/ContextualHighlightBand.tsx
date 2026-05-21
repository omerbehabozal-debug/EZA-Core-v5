'use client';

import { cn } from '@/lib/utils';
import type { ContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import { posterCardSkin as s } from '@/lib/eza/mirror/posterCardSkin';

export type ContextualHighlightBandProps = {
  highlight: ContextualHighlight;
  className?: string;
};

export default function ContextualHighlightBand({
  highlight,
  className,
}: ContextualHighlightBandProps) {
  if (highlight.kind === 'dual_comparison' && highlight.left && highlight.right) {
    return (
      <div className={cn(s.highlightBand, className)}>
        <p className={s.highlightBandTitle}>{highlight.bandTitle}</p>
        <div className={s.highlightDual}>
          <div className={s.highlightSide}>
            <p className={s.highlightSideLabel}>{highlight.left.label}</p>
            <p className={s.highlightSideHint}>{highlight.left.hint}</p>
          </div>
          {highlight.centerBadge ? (
            <span className={s.highlightVs} aria-hidden>
              {highlight.centerBadge}
            </span>
          ) : null}
          <div className={cn(s.highlightSide, 'text-right')}>
            <p className={s.highlightSideLabel}>{highlight.right.label}</p>
            <p className={s.highlightSideHint}>{highlight.right.hint}</p>
          </div>
        </div>
        {highlight.tags.length > 0 ? (
          <div className={s.highlightTags}>
            {highlight.tags.map((tag) => (
              <span key={tag} className={s.highlightTag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(s.highlightBand, className)}>
      <p className={s.highlightBandTitle}>{highlight.bandTitle}</p>
      {highlight.tags.length > 0 ? (
        <div className={s.highlightTags}>
          {highlight.tags.map((tag) => (
            <span key={tag} className={s.highlightTag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
