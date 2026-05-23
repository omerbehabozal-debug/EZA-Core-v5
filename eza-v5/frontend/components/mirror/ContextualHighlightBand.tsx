'use client';

import { cn } from '@/lib/utils';
import type { ContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import type { PosterCompositionProfile } from '@/lib/eza/mirror/posterCompositionSystem';
import { posterCardSkin as defaultSkin, type PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

export type ContextualHighlightBandProps = {
  highlight: ContextualHighlight;
  emphasis?: PosterCompositionProfile['highlightEmphasis'];
  className?: string;
  skin?: PosterSkinTokens;
};

function WhisperBand({
  highlight,
  s,
}: {
  highlight: ContextualHighlight;
  s: PosterSkinTokens;
}) {
  return (
    <div className={s.highlightWhisper}>
      <span className={s.highlightWhisperTitle}>{highlight.bandTitle}</span>
      {highlight.tags.slice(0, 3).map((tag) => (
        <span key={tag} className={s.highlightWhisperTag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function RibbonBand({
  highlight,
  s,
}: {
  highlight: ContextualHighlight;
  s: PosterSkinTokens;
}) {
  return (
    <div className={s.highlightRibbon}>
      <p className={s.highlightRibbonTitle}>{highlight.bandTitle}</p>
      {highlight.tags.length > 0 ? (
        <div className={s.highlightRibbonTags}>
          {highlight.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={s.highlightRibbonTag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProminentDualBand({
  highlight,
  s,
}: {
  highlight: ContextualHighlight;
  s: PosterSkinTokens;
}) {
  if (!highlight.left || !highlight.right) return <RibbonBand highlight={highlight} s={s} />;
  return (
    <div className={s.highlightProminent}>
      <p className={s.highlightProminentTitle}>{highlight.bandTitle}</p>
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
          {highlight.tags.slice(0, 3).map((tag) => (
            <span key={tag} className={s.highlightTag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProminentBand({
  highlight,
  s,
}: {
  highlight: ContextualHighlight;
  s: PosterSkinTokens;
}) {
  if (highlight.kind === 'dual_comparison') {
    return <ProminentDualBand highlight={highlight} s={s} />;
  }
  return <RibbonBand highlight={highlight} s={s} />;
}

export default function ContextualHighlightBand({
  highlight,
  emphasis = 'whisper',
  className,
  skin = defaultSkin,
}: ContextualHighlightBandProps) {
  const body =
    emphasis === 'prominent' ? (
      <ProminentBand highlight={highlight} s={skin} />
    ) : emphasis === 'ribbon' ? (
      <RibbonBand highlight={highlight} s={skin} />
    ) : (
      <WhisperBand highlight={highlight} s={skin} />
    );

  return <div className={cn('w-full', className)}>{body}</div>;
}
