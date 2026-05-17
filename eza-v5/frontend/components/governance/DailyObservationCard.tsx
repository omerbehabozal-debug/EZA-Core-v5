'use client';

import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import {
  GOVERNANCE_OBSERVATION_SUB,
  MIRROR_LABELS,
  STANDALONE_OBSERVATION_SUB,
  type PresentationTone,
} from '@/lib/eza/presentationTone';
import { reportSkin } from '@/lib/eza/reportSkin';

interface DailyObservationCardProps {
  observation: DailyObservationView;
  className?: string;
  tone?: PresentationTone;
}

function MirrorRow({ label, sentence }: { label: string; sentence: string }) {
  return (
    <div className={reportSkin.dailyMirrorRow}>
      <p className={reportSkin.dailyMirrorLabel}>{label}</p>
      <p className={reportSkin.dailyMirrorSentence}>{sentence}</p>
    </div>
  );
}

export default function DailyObservationCard({
  observation,
  className,
  tone = 'governance',
}: DailyObservationCardProps) {
  if (!observation.show) return null;

  const labels = MIRROR_LABELS[tone];
  const sub = tone === 'standalone' ? STANDALONE_OBSERVATION_SUB : GOVERNANCE_OBSERVATION_SUB;

  return (
    <section
      className={cn(reportSkin.dailyCard, className)}
      aria-label="EZA'nın son gözlemi"
    >
      <p className={reportSkin.dailyEyebrow}>EZA&apos;nın son gözlemi</p>
      <p className={reportSkin.dailySub}>{sub}</p>

      {observation.manset ? (
        <p className={reportSkin.dailyManset}>{observation.manset}</p>
      ) : null}

      <div className={reportSkin.dailyMirrorBlock}>
        <MirrorRow label={labels.user} sentence={observation.userLine} />
        <MirrorRow label={labels.ai} sentence={observation.aiLine} />
        <MirrorRow label={labels.balance} sentence={observation.balanceLine} />
      </div>

      <p className={reportSkin.dailySupport}>{observation.supportLine}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={reportSkin.dailyPill}>{observation.signalLevel}</span>
        <span className={reportSkin.dailyPill}>{observation.confidenceLabel}</span>
      </div>

      {observation.yesterdayLine ? (
        <p className={reportSkin.dailyYesterday}>{observation.yesterdayLine}</p>
      ) : null}

      {observation.showWeekPattern && observation.weekPattern.length > 0 ? (
        <div className={reportSkin.dailyPatternBlock}>
          <p className={reportSkin.dailyPatternCaption}>Son etkileşimler</p>
          <div
            className={reportSkin.dailyPatternDots}
            role="list"
            aria-label="Son etkileşim desenleri"
          >
            {observation.weekPattern.map((dot, index) => (
              <span
                key={`${dot.hoverTitle}-${index}`}
                role="listitem"
                className={cn(
                  reportSkin.dailyPatternDot,
                  dot.isLatest && reportSkin.dailyPatternDotLatest
                )}
                title={dot.hoverTitle}
              >
                <span className="text-[11px] leading-none" aria-hidden>
                  {dot.emoji}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {observation.fridaySummary ? (
        <p className={reportSkin.dailyFriday}>{observation.fridaySummary}</p>
      ) : null}
    </section>
  );
}
