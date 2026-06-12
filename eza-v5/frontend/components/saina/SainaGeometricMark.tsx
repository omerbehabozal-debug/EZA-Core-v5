'use client';

import { cn } from '@/lib/utils';

type SainaGeometricMarkProps = {
  className?: string;
  size?: number;
  variant?: 'gold' | 'light' | 'dark';
};

/** Modern relationship geometry — inspired by interlaced symmetry, not literal historic motif. */
export default function SainaGeometricMark({
  className,
  size = 40,
  variant = 'gold',
}: SainaGeometricMarkProps) {
  const stroke =
    variant === 'light' ? '#F6F4EF' : variant === 'dark' ? '#0F3D32' : '#D8B16A';
  const fill =
    variant === 'light'
      ? 'rgba(246,244,239,0.15)'
      : variant === 'dark'
        ? 'rgba(15,61,50,0.12)'
        : 'rgba(216,177,106,0.18)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22" stroke={stroke} strokeWidth="0.75" opacity="0.45" />
      <path
        d="M24 6 L42 24 L24 42 L6 24 Z"
        stroke={stroke}
        strokeWidth="1"
        fill={fill}
        opacity="0.9"
      />
      <path
        d="M24 12 L36 24 L24 36 L12 24 Z"
        stroke={stroke}
        strokeWidth="0.85"
        fill="none"
        opacity="0.75"
      />
      <circle cx="24" cy="24" r="4" fill={stroke} opacity="0.85" />
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1="24"
          y1="24"
          x2={24 + 14 * Math.cos((deg * Math.PI) / 180)}
          y2={24 + 14 * Math.sin((deg * Math.PI) / 180)}
          stroke={stroke}
          strokeWidth="0.6"
          opacity="0.5"
        />
      ))}
    </svg>
  );
}
