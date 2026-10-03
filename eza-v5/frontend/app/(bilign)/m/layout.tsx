import type { ReactNode } from 'react';
import '@/styles/saina-yansi-mobile-public.css';
import '@/styles/yansi-experience-controls.css';
import '@/styles/yansi-reel-responsive.css';

/**
 * Public Yansı segment — desktop chrome lives on the shared parent layout.
 * This wrapper only carries /m styles and the mobile layout marker.
 */
export default function MirrorLandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="yansi-public-layout" data-mirror-landing-layout>
      {children}
    </div>
  );
}
