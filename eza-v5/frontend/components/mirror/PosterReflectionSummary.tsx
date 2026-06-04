'use client';

import type { ReactNode } from 'react';
import { Heart, Sparkles, User } from 'lucide-react';
import type { PosterActivityRow, PosterRelationshipBar } from '@/lib/eza/mirror/posterCardContent';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';

export type PosterReflectionSummaryProps = {
  journeyHeadline: string;
  storyLine: string;
  quote: string;
  activities: PosterActivityRow[];
  relationshipBars: PosterRelationshipBar[];
  energyLabel: string;
  energyPercent: number;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

function MiniInsight({
  label,
  line,
  icon,
  skin,
}: {
  label: string;
  line: string;
  icon: ReactNode;
  skin: PosterSkinTokens;
}) {
  return (
    <div className={skin.insightCardCompact}>
      <div className="mb-0.5 flex items-center gap-1 text-[#7B61FF]">
        {icon}
        <span className={skin.insightLabelCompact}>{label}</span>
      </div>
      <p className={skin.insightLineCompact}>{line}</p>
    </div>
  );
}

export default function PosterReflectionSummary({
  journeyHeadline,
  storyLine,
  quote,
  activities,
  relationshipBars,
  energyLabel,
  energyPercent,
  skin,
  isSparse = false,
}: PosterReflectionSummaryProps) {
  const energyDeg = Math.round(Math.min(100, Math.max(0, energyPercent)) * 3.6);
  const sen = activities.find((a) => a.label === 'Sen');
  const ai = activities.find((a) => a.label === 'AI');
  const balance = activities.find((a) => a.label === 'Denge');

  return (
    <section className={skin.reflectionZone} aria-label="Günün yansıması">
      <div className={skin.reflectionHeaderRow}>
        <h3 className={skin.reflectionHeadline}>
          {isSparse ? 'Yansıma hazırlanıyor' : journeyHeadline}
        </h3>
        {!isSparse ? (
          <div
            className={skin.energyBadge}
            style={{ ['--energy-deg' as string]: `${energyDeg}deg` }}
          >
            <span className={skin.energyRing} aria-hidden>
              {energyPercent}
            </span>
            <span>{energyLabel}</span>
          </div>
        ) : null}
      </div>
      <p className={skin.reflectionStory}>
        {isSparse ? MIRROR_INSUFFICIENT : storyLine}
      </p>
      {!isSparse && quote ? (
        <p className={skin.reflectionQuote}>
          <span aria-hidden>“</span>
          {quote}
          <span aria-hidden>”</span>
        </p>
      ) : null}
      {!isSparse ? (
        <>
          <div className={skin.insightsCompact}>
            <MiniInsight
              skin={skin}
              label="Sen"
              line={sen?.value ?? '—'}
              icon={<User className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <MiniInsight
              skin={skin}
              label="AI"
              line={ai?.value ?? '—'}
              icon={<Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <MiniInsight
              skin={skin}
              label="Denge"
              line={balance?.value ?? '—'}
              icon={<Heart className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
          </div>
          <div className={skin.relationshipBarsWrap} aria-hidden>
            {relationshipBars.map((bar) => (
              <div key={bar.label} className={skin.relationshipBarTrack} title={bar.label}>
                <div
                  className={skin.relationshipBarFill}
                  style={{ width: `${bar.percent}%` }}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
