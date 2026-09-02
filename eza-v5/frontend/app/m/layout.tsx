import type { ReactNode } from 'react';
import '@/styles/saina-mirror.css';
import '@/styles/saina-yansi-mobile-public.css';
import '@/styles/yansi-experience-controls.css';

/**
 * Public mirror landing — no app chrome, editorial full-bleed.
 */
export default function MirrorLandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#090b0b] antialiased" data-mirror-landing-layout>
      {children}
    </div>
  );
}
