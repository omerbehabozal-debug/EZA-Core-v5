'use client';

import { cn } from '@/lib/utils';
import { PATTERN_PREVIEW_SECTION_NOTE } from '@/components/mirror/relationship/patternPreviewContent';

export default function PatternPreviewSectionNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'rounded-xl border border-dashed border-violet-200/60 bg-violet-50/40 px-4 py-2.5 text-center text-[12px] font-medium text-violet-600/90',
        className
      )}
    >
      {PATTERN_PREVIEW_SECTION_NOTE}
    </p>
  );
}
