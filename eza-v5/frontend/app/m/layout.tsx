import type { ReactNode } from 'react';

/**
 * Public mirror landing — no app chrome, editorial full-bleed.
 */
export default function MirrorLandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0c0b0a] antialiased" data-mirror-landing-layout>
      {children}
    </div>
  );
}
