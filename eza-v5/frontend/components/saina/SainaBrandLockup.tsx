import { cn } from '@/lib/utils';
import { SAINA_BRAND, SAINA_BRAND_BYLINE } from '@/lib/eza/sainaCopy';

export const BILIGN_MARK_SRC = '/bilign/bilign-mark.png';
export const BILIGN_WORDMARK_SRC = '/bilign/bilign-wordmark.png';
export const BILIGN_MARK_INTRINSIC = { width: 281, height: 285 } as const;
export const BILIGN_WORDMARK_INTRINSIC = { width: 1024, height: 724 } as const;
export const BILIGN_WORDMARK_ASPECT =
  BILIGN_WORDMARK_INTRINSIC.width / BILIGN_WORDMARK_INTRINSIC.height;

type SainaBrandLockupProps = {
  className?: string;
};

/** biligN header — separate mark + wordmark assets with a quiet EZA byline. */
export default function SainaBrandLockup({ className }: SainaBrandLockupProps) {
  return (
    <div
      className={cn('saina-brand-split', className)}
      data-testid="saina-brand-lockup"
      aria-label={`${SAINA_BRAND} — ${SAINA_BRAND_BYLINE}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- original mark PNG. */}
      <img
        src={BILIGN_MARK_SRC}
        alt=""
        aria-hidden
        draggable={false}
        width={BILIGN_MARK_INTRINSIC.width}
        height={BILIGN_MARK_INTRINSIC.height}
        className="saina-brand-split-mark"
      />
      <div className="saina-brand-split-text">
        {/* eslint-disable-next-line @next/next/no-img-element -- original wordmark PNG. */}
        <img
          src={BILIGN_WORDMARK_SRC}
          alt={SAINA_BRAND}
          draggable={false}
          width={BILIGN_WORDMARK_INTRINSIC.width}
          height={BILIGN_WORDMARK_INTRINSIC.height}
          className="saina-brand-split-wordmark"
        />
        <span className="saina-brand-eza">{SAINA_BRAND_BYLINE}</span>
      </div>
    </div>
  );
}
