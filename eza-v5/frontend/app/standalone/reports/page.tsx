'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski URL — standalone sohbet yüzeyine yönlendir */
export default function StandaloneReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/standalone');
  }, [router]);
  return null;
}
