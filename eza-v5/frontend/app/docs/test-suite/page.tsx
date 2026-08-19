import { notFound } from 'next/navigation';
import { isExplicitNonProductionFrontendSurfaceAllowed } from '@/lib/eza/productionSurfaceGuard';
import TestSuitePageClient from './TestSuitePageClient';

export default function TestSuitePage() {
  if (!isExplicitNonProductionFrontendSurfaceAllowed()) {
    notFound();
  }

  return <TestSuitePageClient />;
}
