'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RelationshipInsightNoteProps = {
  body: string;
  className?: string;
};

export default function RelationshipInsightNote({ body, className }: RelationshipInsightNoteProps) {
  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-violet-100/80 bg-gradient-to-br from-white via-white to-violet-50/50 p-5 shadow-[0_10px_36px_-16px_rgba(123,97,255,0.2)]',
        className
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B61FF]">
        <Sparkles className="h-3 w-3" aria-hidden />
        EZA&apos;dan Kısa Not
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#172033]/88">{body}</p>
    </article>
  );
}
