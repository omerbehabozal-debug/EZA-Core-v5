import { cn } from '@/lib/utils';
import { SAINA_BRAND, SAINA_POWERED } from '@/lib/eza/sainaCopy';

export const BILIGN_LOCKUP_SRC = '/bilign/bilign-lockup.png';
export const BILIGN_LOCKUP_INTRINSIC_WIDTH = 1024;
export const BILIGN_LOCKUP_INTRINSIC_HEIGHT = 724;

/** Lockup aspect ratio from the official biligN asset (1024×724). */
export const BILIGN_LOCKUP_ASPECT = BILIGN_LOCKUP_INTRINSIC_WIDTH / BILIGN_LOCKUP_INTRINSIC_HEIGHT;

type SainaBrandLockupProps = {
  className?: string;
  /** Optional explicit height in px; prefer CSS size modifiers when possible. */
  height?: number;
};

/** Full biligN lockup — mark, wordmark, and Powered by EZA in one original asset. */
export default function SainaBrandLockup({
  className,
  height,
}: SainaBrandLockupProps) {
  const inlineSize =
    height != null
      ? { height, width: Math.round(height * BILIGN_LOCKUP_ASPECT) }
      : undefined;

  return (
    <span className={cn('saina-brand-lockup', className)} data-testid="saina-brand-lockup">
      {/* eslint-disable-next-line @next/next/no-img-element -- official lockup PNG; preserves designed proportions. */}
      <img
        src={BILIGN_LOCKUP_SRC}
        alt={`${SAINA_BRAND} — ${SAINA_POWERED}`}
        draggable={false}
        width={BILIGN_LOCKUP_INTRINSIC_WIDTH}
        height={BILIGN_LOCKUP_INTRINSIC_HEIGHT}
        className="saina-brand-lockup-img"
        style={inlineSize}
      />
    </span>
  );
}
