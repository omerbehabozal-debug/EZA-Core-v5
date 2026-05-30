'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MIRROR_DAILY_ROUTE } from '@/lib/eza/mirror/copy';

/** Ayna index → varsayılan görünüm (Günlük Ayna). */
export default function StandaloneMirrorIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(MIRROR_DAILY_ROUTE);
  }, [router]);
  return null;
}
