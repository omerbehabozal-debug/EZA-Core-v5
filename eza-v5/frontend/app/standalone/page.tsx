/**
 * Standalone Chat — çoklu sohbet sekmeleri (?chat=id)
 */

import { Suspense } from 'react';
import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';

function StandaloneChatFallback() {
  return <div className="saina-route-fallback min-h-0 flex-1" aria-hidden />;
}

export default function StandalonePage() {
  return (
    <Suspense fallback={<StandaloneChatFallback />}>
      <StandaloneChatInner />
    </Suspense>
  );
}
