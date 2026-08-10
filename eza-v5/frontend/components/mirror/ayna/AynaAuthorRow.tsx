'use client';

import { cn } from '@/lib/utils';

export type AynaAuthorRowProps = {
  displayName: string;
  avatarUrl?: string | null;
  onOpenProfile?: () => void;
  className?: string;
};

/**
 * Current Yansı author — navigates to that person's published Yansılar.
 */
export default function AynaAuthorRow({
  displayName,
  avatarUrl,
  onOpenProfile,
  className,
}: AynaAuthorRowProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || 'Y';
  const interactive = typeof onOpenProfile === 'function';

  const inner = (
    <>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.08] text-[11px] font-semibold text-[rgba(246,244,239,0.9)]"
        aria-hidden
      >
        {avatarUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
      <span className="min-w-0 truncate text-[12px] font-medium tracking-tight text-[rgba(246,244,239,0.92)]">
        {displayName}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div
        className={cn('flex items-center gap-2', className)}
        data-testid="ayna-author-row"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg text-left transition-colors',
        'hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(231,180,91,0.45)]',
        className
      )}
      onClick={onOpenProfile}
      data-testid="ayna-author-row"
      aria-label={`${displayName} profilini aç`}
    >
      {inner}
    </button>
  );
}
