import { notFound } from 'next/navigation';
import MirrorV2QaLab from '@/components/mirror/MirrorV2QaLab';
import { isExplicitNonProductionFrontendSurfaceAllowed } from '@/lib/eza/productionSurfaceGuard';

export const metadata = {
  title: 'Mirror V2 Lab | biligN',
  robots: { index: false, follow: false },
};

export default function MirrorV2LabPage() {
  if (!isExplicitNonProductionFrontendSurfaceAllowed()) {
    notFound();
  }

  return <MirrorV2QaLab />;
}
