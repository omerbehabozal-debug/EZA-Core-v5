'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski URL — Etkileşim Raporu sayfasına yönlendir */
export default function StandaloneInsightsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/standalone/reports');
  }, [router]);
  return null;
}
