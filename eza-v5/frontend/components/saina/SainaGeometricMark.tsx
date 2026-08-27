import { cn } from '@/lib/utils';

export const BILIGN_MARK_SRC = '/bilign/bilign-mark.svg';

type SainaGeometricMarkProps = {
  className?: string;
  size?: number;
  variant?: 'gold' | 'light' | 'dark';
};

/** Original biligN mark asset — form is not redrawn in CSS. */
export default function SainaGeometricMark({
  className,
  size = 40,
  variant = 'gold',
}: SainaGeometricMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- original SVG asset; Next Image would crop/reflow the mark.
    <img
      src={BILIGN_MARK_SRC}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
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
