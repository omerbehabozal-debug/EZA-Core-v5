import { cn } from '@/lib/utils';
import { SAINA_BRAND } from '@/lib/eza/sainaCopy';

export const BILIGN_WORDMARK_SRC = '/bilign/bilign-wordmark.png';

type SainaBrandWordmarkProps = {
  className?: string;
  height?: number;
};

/** Original biligN wordmark asset — custom letterforms, not a system font. */
export default function SainaBrandWordmark({
  className,
  height = 22,
}: SainaBrandWordmarkProps) {
  return (
    <span className={cn('saina-brand-wordmark-lockup', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- original SVG wordmark. */}
      <img
        src={BILIGN_WORDMARK_SRC}
        alt=""
        draggable={false}
        className="saina-brand-wordmark-img"
        style={{ height }}
      />
      <span className="sr-only">{SAINA_BRAND}</span>
    </span>
  );
}
