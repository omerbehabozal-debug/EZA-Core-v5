import { Suspense } from 'react';
import SainaBusinessManager from '@/components/saina/SainaBusinessManager';

export default function BusinessPage() {
  return (
    <Suspense fallback={<main className="biz-panel"><p className="biz-section-lead" style={{ padding: 24 }}>Yükleniyor…</p></main>}>
      <SainaBusinessManager />
    </Suspense>
  );
}
