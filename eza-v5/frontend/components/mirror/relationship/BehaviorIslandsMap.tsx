'use client';

import { cn } from '@/lib/utils';
import type { BehaviorIsland } from '@/lib/eza/relationshipMapModel';
import BehaviorIslandBlob from '@/components/mirror/relationship/BehaviorIslandBlob';

const SLOT_POSITIONS = [
  { left: '8%', top: '12%' },
  { left: '38%', top: '4%' },
  { left: '62%', top: '18%' },
  { left: '4%', top: '48%' },
  { left: '32%', top: '52%' },
  { left: '58%', top: '46%' },
];

export type BehaviorIslandsMapProps = {
  islands: BehaviorIsland[];
  ghost?: boolean;
  className?: string;
};

export default function BehaviorIslandsMap({
  islands,
  ghost = false,
  className,
}: BehaviorIslandsMapProps) {
  const visible = islands.slice(0, 6);

  return (
    <div
      className={cn(
        'relative min-h-[20rem] w-full overflow-hidden rounded-[2rem] sm:min-h-[24rem]',
        className
      )}
      aria-label="Davranış adaları haritası"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,rgba(196,181,253,0.18),transparent_65%)]"
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-violet-300/35"
        viewBox="0 0 400 320"
        preserveAspectRatio="none"
        aria-hidden
      >
        <ellipse
          cx="200"
          cy="160"
          rx="165"
          ry="118"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="5 8"
        />
        <ellipse
          cx="200"
          cy="160"
          rx="118"
          ry="82"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="3 10"
          opacity="0.6"
        />
      </svg>
      {[8, 22, 36].map((top) => (
        <span
          key={top}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-violet-400/40"
          style={{ left: `${top + 40}%`, top: `${top}%` }}
          aria-hidden
        />
      ))}

      {visible.map((island, index) => {
        const slot = SLOT_POSITIONS[index] ?? SLOT_POSITIONS[0]!;
        return (
          <div
            key={`${island.id}-${ghost}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: slot.left, top: slot.top }}
          >
            <BehaviorIslandBlob island={island} ghost={ghost} />
          </div>
        );
      })}
    </div>
  );
}
