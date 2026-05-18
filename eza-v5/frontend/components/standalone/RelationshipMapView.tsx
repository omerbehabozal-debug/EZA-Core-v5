'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildRelationshipMap,
  type RelationshipPeriodDays,
} from '@/lib/eza/relationshipMapModel';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface RelationshipMapViewProps {
  entries: SavedBehavioralEntry[];
  className?: string;
}

const PERIODS: { days: RelationshipPeriodDays; label: string }[] = [
  { days: 7, label: '7 Gün' },
  { days: 30, label: '30 Gün' },
  { days: 90, label: '90 Gün' },
];

export default function RelationshipMapView({ entries, className }: RelationshipMapViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodDays>(30);

  const model = useMemo(
    () => buildRelationshipMap(entries, period),
    [entries, period]
  );

  return (
    <section className={cn('px-4 py-8 sm:px-6 sm:py-10', className)} aria-label="EZA İlişki Haritası">
      <header className="max-w-2xl">
        <p className={standaloneSkin.observationEyebrow}>EZA İlişki Haritası</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-2xl">
          Zaman içindeki etkileşim desenin
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Klasik grafik yerine davranış adaları — gözlemsel yoğunluk, kişilik testi değil.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setPeriod(p.days)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              period === p.days
                ? 'bg-violet-100 text-violet-900'
                : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/60'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <div className={standaloneSkin.relationshipBalanceCard}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Genel denge
          </p>
          <p className="mt-2 text-lg font-medium text-stone-900">{model.generalBalanceLabel}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">{model.generalBalanceHint}</p>
          <p className="mt-4 text-[11px] text-stone-400">
            {model.totalInteractions} etkileşim · son {model.periodDays} gün
          </p>
        </div>

        <div className={standaloneSkin.relationshipIslandsWrap}>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Davranış adaları
          </p>
          {model.islands.length === 0 ? (
            <p className="text-sm text-stone-500">
              Henüz ada oluşmadı. Birkaç sohbetten sonra desenler burada belirir.
            </p>
          ) : (
            <div className={standaloneSkin.relationshipIslandsGrid}>
              {model.islands.map((island) => (
                <div
                  key={island.id}
                  className={standaloneSkin.relationshipIsland}
                  style={{
                    background: `linear-gradient(135deg, ${island.color}22, ${island.color}44)`,
                    borderColor: `${island.color}55`,
                  }}
                  title={`${island.label} · %${island.percent}`}
                >
                  <span className="text-sm font-medium text-stone-800">{island.label}</span>
                  <span className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                    %{island.percent}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className={standaloneSkin.relationshipBarCard}>
          <h3 className="text-sm font-medium text-stone-800">AI davranış dağılımı</h3>
          <ul className="mt-4 space-y-3">
            {model.aiBehaviorBars.map((bar) => (
              <li key={bar.label}>
                <div className="flex justify-between text-xs text-stone-600">
                  <span>{bar.label}</span>
                  <span>%{bar.percent}</span>
                </div>
                <div className={standaloneSkin.relationshipBarTrack}>
                  <div
                    className={standaloneSkin.relationshipBarFill}
                    style={{ width: `${Math.max(6, bar.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={standaloneSkin.relationshipBarCard}>
          <h3 className="text-sm font-medium text-stone-800">İlişki denge özeti</h3>
          <ul className="mt-4 space-y-3">
            {model.balanceBars.map((bar) => (
              <li key={bar.label}>
                <div className="flex justify-between text-xs text-stone-600">
                  <span>{bar.label}</span>
                  <span>%{bar.percent}</span>
                </div>
                <div className={standaloneSkin.relationshipBarTrack}>
                  <div
                    className={standaloneSkin.relationshipBarFillAlt}
                    style={{ width: `${Math.max(6, bar.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={standaloneSkin.relationshipNoteCard}>
        <span className="text-lg" aria-hidden>
          💜
        </span>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">{model.shortNote}</p>
        {model.avgDepthScore !== null ? (
          <p className="mt-3 text-xs text-stone-500">
            Ortalama etkileşim derinliği (gözlemsel):{' '}
            <span className="font-medium text-stone-700">{model.avgDepthScore}/10</span>
          </p>
        ) : null}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-stone-400">
        EZA analizleri gözlemsel sinyaller üretir. Kesin karar yerine farkındalık sağlamayı amaçlar.
      </p>
    </section>
  );
}