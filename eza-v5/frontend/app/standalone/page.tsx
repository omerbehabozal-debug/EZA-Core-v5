/**
 * Standalone Chat — çoklu sohbet sekmeleri (?chat=id)
 */

import { Suspense } from 'react';
import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

function StandaloneChatFallback() {
  return (
    <div className={`${standaloneSkin.page} flex items-center justify-center`}>
      <p className="text-sm text-standalone-text-muted">Sohbet yükleniyor…</p>
    </div>
  );
}

export default function StandalonePage() {
  return (
    <Suspense fallback={<StandaloneChatFallback />}>
      <StandaloneChatInner />
    </Suspense>
  );
}
