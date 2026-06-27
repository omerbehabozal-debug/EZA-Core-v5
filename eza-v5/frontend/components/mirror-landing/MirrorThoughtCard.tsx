'use client';

import type { MirrorThoughtCard } from '@/lib/eza/mirror-network/sohbetTypes';
import { cn } from '@/lib/utils';

export type MirrorThoughtCardProps = {
  card: MirrorThoughtCard;
  onSelect?: (card: MirrorThoughtCard) => void;
  className?: string;
};

/**
 * Editorial thought card — not a question button.
 */
export default function MirrorThoughtCardButton({
  card,
  onSelect,
  className,
}: MirrorThoughtCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(card)}
      className={cn(
        'group w-full rounded-xl border border-[#e8d5b5]/20 bg-[#141210]/80 px-4 py-3.5 text-left',
        'transition-colors hover:border-[#e8d5b5]/40 hover:bg-[#1a1714]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d5b5]/50',
        className
      )}
      data-mirror-thought-card={card.id}
    >
      <span
        className="mr-3 inline-block align-middle text-[#8a8074] transition-colors group-hover:text-[#c9bba8]"
        aria-hidden
      >
        □
      </span>
      <span className="text-sm font-medium leading-snug text-[#f0e8da]">{card.label}</span>
    </button>
  );
}
