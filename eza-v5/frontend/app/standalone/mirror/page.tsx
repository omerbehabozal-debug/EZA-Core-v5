'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Ayna index — Conversation Mirror chat içinde; daily artık varsayılan değil. */
export default function StandaloneMirrorIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/standalone');
  }, [router]);
  return null;
}
