'use client';

import { cn } from '@/lib/utils';
import type { TimelinePoint } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type RelationshipTimelineChartProps = {
  points: TimelinePoint[];
  className?: string;
};

export default function RelationshipTimelineChart({
  points,
  className,
}: RelationshipTimelineChartProps) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const width = 280;
  const height = 120;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((p, i) => {
    const x = padX + (i / Math.max(1, points.length - 1)) * innerW;
    const y = padY + innerH - (p.value / max) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? padX} ${padY + innerH} L ${coords[0]?.x ?? padX} ${padY + innerH} Z`;

  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-[#172033]">Zaman İçinde Denge</h3>
      <p className="mt-1 text-xs text-[#667085]">Etkileşim yoğunluğunun sakin özeti</p>
      <div className="mt-4 flex justify-center">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="max-h-[140px] text-violet-500"
          role="img"
          aria-label="Zaman içinde denge grafiği"
        >
          <defs>
            <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B61FF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#7B61FF" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#timelineFill)" />
          <path d={linePath} fill="none" stroke="#7B61FF" strokeWidth="2.5" strokeLinecap="round" />
          {coords.map((c) => (
            <g key={c.label}>
              <circle cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#7B61FF" strokeWidth="2" />
              <text
                x={c.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-[#667085] text-[9px]"
              >
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </article>
  );
}
