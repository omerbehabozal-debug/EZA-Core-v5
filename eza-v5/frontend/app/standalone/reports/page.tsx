'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MIRROR_ROUTE } from '@/lib/eza/mirror/copy';

/** Eski URL — EZA Mirror sayfasına yönlendir */
export default function StandaloneReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(MIRROR_ROUTE);
  }, [router]);
  return null;
}
