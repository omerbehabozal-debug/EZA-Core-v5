'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

/** Eski URL — İlişki Deseni yüzeyine yönlendir */
export default function StandaloneInsightsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(MIRROR_PATTERN_ROUTE);
  }, [router]);
  return null;
}
