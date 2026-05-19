'use client';

import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const s = standaloneSkin.relationshipMapPolish;

/** Dekoratif organik bağlantı çizgileri — veri/API değişmez. */
export default function MapConnectors({ className }: { className?: string }) {
  return (
    <svg
      className={cn(s.mapConnectors, className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="eza-map-connector-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(167,139,250)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(129,140,248)" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="eza-map-connector-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(56,189,248)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgb(167,139,250)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path
        d="M 14 28 Q 38 18 58 22 T 82 30"
        fill="none"
        stroke="url(#eza-map-connector-a)"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
      <path
        d="M 22 52 Q 48 44 62 48 T 88 58"
        fill="none"
        stroke="url(#eza-map-connector-b)"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
      <path
        d="M 10 68 Q 42 62 55 70 T 78 78"
        fill="none"
        stroke="url(#eza-map-connector-a)"
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
    </svg>
  );
}
