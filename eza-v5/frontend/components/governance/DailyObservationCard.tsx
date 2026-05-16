'use client';

import { cn } from '@/lib/utils';
import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { reportSkin } from '@/lib/eza/reportSkin';

interface DailyObservationCardProps {
  observation: DailyObservationView;
  className?: string;
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
}: DailyObservationCardProps) {
  if (!observation.show) return null;

  return (
    <section
      className={cn(reportSkin.dailyCard, className)}
      aria-label="EZA'nın son gözlemi"
    >
      <p className={reportSkin.dailyEyebrow}>EZA&apos;nın son gözlemi</p>
      <p className={reportSkin.dailySub}>
        Son etkileşim oturumundan çıkan kısa bir gözlem notu.
      </p>

      {observation.manset ? (
        <p className={reportSkin.dailyManset}>{observation.manset}</p>
      ) : null}

      <div className={reportSkin.dailyMirrorBlock}>
        <MirrorRow label="Sen" sentence={observation.userLine} />
        <MirrorRow label="AI" sentence={observation.aiLine} />
        <MirrorRow label="Denge" sentence={observation.balanceLine} />
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
