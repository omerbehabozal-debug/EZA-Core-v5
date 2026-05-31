'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RelationshipInsightNoteProps = {
  body: string;
  className?: string;
  preview?: boolean;
};

export default function RelationshipInsightNote({
  body,
  className,
  preview = false,
}: RelationshipInsightNoteProps) {
  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-violet-100/80 bg-gradient-to-br from-white via-white to-violet-50/50 p-5 shadow-[0_10px_36px_-16px_rgba(123,97,255,0.2)]',
        preview && 'pointer-events-none select-none border-stone-200/80 opacity-45 saturate-[0.55]',
        className
      )}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B61FF]',
          preview && 'text-stone-400'
        )}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        EZA&apos;dan Kısa Not
      </p>
      <p
        className={cn(
          'mt-2 text-sm leading-relaxed text-[#172033]/88',
          preview && 'text-stone-400'
        )}
      >
        {body}
      </p>
    </article>
  );
}
