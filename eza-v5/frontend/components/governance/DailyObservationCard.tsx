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
      aria-label="EZA'nın bugünkü gözlemi"
    >
      <p className={reportSkin.dailyEyebrow}>EZA&apos;nın bugünkü gözlemi</p>
      <p className={reportSkin.dailySub}>
        Bugünkü konuşmalarından çıkan kısa bir etkileşim notu.
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
        <div className={reportSkin.dailyWeekRow} role="list" aria-label="Son 7 gün">
          {observation.weekPattern.map((day) => (
            <div
              key={`${day.weekdayLabel}-${day.categoryLabel}`}
              role="listitem"
              className={cn(
                reportSkin.dailyWeekCell,
                day.isToday && reportSkin.dailyWeekCellToday
              )}
              title={
                day.hasData
                  ? `${day.weekdayLabel} · ${day.categoryLabel}`
                  : 'Bu gün için kayıt yok'
              }
            >
              <span className={reportSkin.dailyWeekLabel}>{day.weekdayLabel}</span>
              <span className="text-sm leading-none" aria-hidden>
                {day.emoji}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {observation.fridaySummary ? (
        <p className={reportSkin.dailyFriday}>{observation.fridaySummary}</p>
      ) : null}
    </section>
  );
}
