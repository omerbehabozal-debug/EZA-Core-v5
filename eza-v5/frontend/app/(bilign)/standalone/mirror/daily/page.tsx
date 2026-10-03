'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy light Daily Mirror UI — cancelled.
 * Bookmarks / old Share confusion must not reopen text-on-image onboarding.
 * Live Ayna runs inside SAINA chat (`SainaStandaloneMirrorPanel`).
 */
export default function StandaloneMirrorDailyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/standalone/discover');
  }, [router]);
  return null;
}
