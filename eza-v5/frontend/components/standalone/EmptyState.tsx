/**
 * EmptyState — slogan only (kart yok)
 */

import { standaloneSkin } from '@/lib/eza/standaloneSkin';

export default function EmptyState() {
  return (
    <div className={standaloneSkin.emptySlogan} role="status">
      <h2 className={standaloneSkin.emptyTitle}>AI ile yazışırken neler olduğunu görün.</h2>
      <p className={standaloneSkin.emptyBody}>
        Mesajları, risk sinyallerini, yönlendirme etkilerini ve etkileşim dengesini analiz eder.
      </p>
    </div>
  );
}
