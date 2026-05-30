'use client';

import type { ReactNode } from 'react';

/** Günlük ↔ İlişki route geçişinde sakin bir fade (premium polisaj). */
export default function MirrorTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-fade-in">{children}</div>
  );
}
