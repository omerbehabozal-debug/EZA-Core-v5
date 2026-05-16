'use client';

import { useEffect, useState } from 'react';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import BehavioralIntelligenceDashboard from '@/components/standalone/BehavioralIntelligenceDashboard';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  readBehavioralHistory,
  clearBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';

export default function StandaloneReportsPage() {
  const [items, setItems] = useState<SavedBehavioralEntry[]>([]);

  useEffect(() => {
    setItems(readBehavioralHistory());
  }, []);

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
