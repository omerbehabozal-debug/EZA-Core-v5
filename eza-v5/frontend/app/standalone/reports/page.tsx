'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import BehavioralIntelligenceDashboard from '@/components/standalone/BehavioralIntelligenceDashboard';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  BEHAVIORAL_HISTORY_UPDATED,
  readBehavioralHistory,
  clearBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';

export default function StandaloneReportsPage() {
  const pathname = usePathname();
  const [items, setItems] = useState<SavedBehavioralEntry[]>([]);

  const refreshHistory = useCallback(() => {
    setItems(readBehavioralHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [pathname, refreshHistory]);

  useEffect(() => {
    const onUpdate = () => refreshHistory();
    window.addEventListener(BEHAVIORAL_HISTORY_UPDATED, onUpdate);
    window.addEventListener('focus', onUpdate);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onUpdate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(BEHAVIORAL_HISTORY_UPDATED, onUpdate);
      window.removeEventListener('focus', onUpdate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshHistory]);

  const handleClear = () => {
    if (items.length > 0 && !window.confirm('Tüm davranış analizi verisi silinsin mi?')) return;
    clearBehavioralHistory();
    setItems([]);
  };

  return (
    <div className={standaloneSkin.page}>
      <StandalonePageShell>
        <div className="mx-auto w-full max-w-3xl">
          <BehavioralIntelligenceDashboard entries={items} onClear={handleClear} />
        </div>
      </StandalonePageShell>
    </div>
  );
}
