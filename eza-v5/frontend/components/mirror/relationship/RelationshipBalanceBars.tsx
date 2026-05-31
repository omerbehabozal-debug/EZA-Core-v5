'use client';

import BehaviorToneBars from '@/components/mirror/relationship/BehaviorToneBars';
import type { BarMetric } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type RelationshipBalanceBarsProps = {
  bars: BarMetric[];
  className?: string;
  preview?: boolean;
};

export default function RelationshipBalanceBars({
  bars,
  className,
  preview = false,
}: RelationshipBalanceBarsProps) {
  return (
    <BehaviorToneBars
      title="İlişki Denge Özeti"
      subtitle="Konuşma ritminizin genel dağılımı."
      bars={bars}
      accent="sky"
      preview={preview}
      className={className}
    />
  );
}
