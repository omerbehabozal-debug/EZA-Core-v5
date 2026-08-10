'use client';

import { cn } from '@/lib/utils';
import { formatParentLineageLabel } from '@/lib/eza/mirror/journey/aynaAuthorDisplay';

export type AynaParentLineageRowProps = {
  parentAuthorDisplayName?: string | null;
  parentPublicTitle?: string | null;
  /** Opens the PARENT Yansı — never the parent author's profile. */
  onOpenParent?: () => void;
  className?: string;
};

/**
 * Parent curiosity lineage — secondary to current author.
 */
export default function AynaParentLineageRow({
  parentAuthorDisplayName,
  parentPublicTitle,
  onOpenParent,
  className,
}: AynaParentLineageRowProps) {
  const label = formatParentLineageLabel(parentAuthorDisplayName);
  const interactive = typeof onOpenParent === 'function';
  const title = parentPublicTitle?.trim() || label;

  if (!interactive) {
    return (
      <p
        className={cn(
          'pl-9 text-[11px] leading-snug text-[rgba(217,196,163,0.72)]',
          className
        )}
        data-testid="ayna-parent-lineage"
      >
        ↳ {label}
      </p>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'block w-full rounded-md pl-9 text-left text-[11px] leading-snug text-[rgba(217,196,163,0.78)]',
        'transition-colors hover:text-[rgba(246,244,239,0.9)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(231,180,91,0.45)]',
        className
      )}
      onClick={onOpenParent}
      data-testid="ayna-parent-lineage"
      aria-label={`Üst Yansıyı aç: ${title}`}
    >
      ↳ {label}
    </button>
  );
}
