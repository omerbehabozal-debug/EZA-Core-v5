'use client';

import { cn } from '@/lib/utils';

const SAINA_MARK_SRC = '/saina/saina-mark-original-sadik.svg';

type SainaGeometricMarkProps = {
  className?: string;
  size?: number;
  variant?: 'gold' | 'light' | 'dark';
};

/** Original SAINA mark — raster preserved inside project SVG asset. */
export default function SainaGeometricMark({
  className,
  size = 40,
  variant = 'gold',
}: SainaGeometricMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand SVG; Next Image adds layout constraints we avoid for crisp scaling.
    <img
      src={SAINA_MARK_SRC}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn(
        'saina-geometric-mark shrink-0',
        variant === 'light' && 'saina-geometric-mark--light',
        variant === 'dark' && 'saina-geometric-mark--dark',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
