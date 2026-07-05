'use client';

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LockedTeaserTileProps {
  label: string;
  onUpgrade: () => void;
  className?: string;
}

/**
 * Free kullanıcıya Plus özelliğini hissettiren küçük kilitli kutu.
 * Tıklanınca ortak upsell akışını (UpgradeModal) tetikler.
 */
export default function LockedTeaserTile({
  label,
  onUpgrade,
  className,
}: LockedTeaserTileProps) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className={cn(
        'group relative flex items-center gap-2 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/55 px-3.5 py-3 text-left backdrop-blur-sm transition-colors hover:border-violet-200/70 hover:bg-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/60',
        className
      )}
      aria-label={`${label} — hesabını yükselttiğinde açılır`}
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition-colors group-hover:bg-violet-100 group-hover:text-violet-500"
        aria-hidden
      >
        <Lock className="h-3 w-3" strokeWidth={2} />
      </span>
      <span className="truncate text-[13px] font-medium text-stone-500 group-hover:text-stone-700">
        {label}
      </span>
    </button>
  );
}
