/**
 * Risk Badge Component
 * Color-coded risk level badge
 */

'use client';

import { cn } from '@/lib/utils';

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high' | string;
  className?: string;
}

export default function RiskBadge({ level, className }: RiskBadgeProps) {
  const normalizedLevel = level.toLowerCase() as 'low' | 'medium' | 'high';
  
  const variants = {
    low: {
      bg: 'bg-[#4CAF50]/20',
      text: 'text-[#4CAF50]',
      border: 'border-[#4CAF50]/30',
      label: 'Düşük Risk'
    },
    medium: {
      bg: 'bg-[#FFC107]/20',
      text: 'text-[#FFC107]',
      border: 'border-[#FFC107]/30',
      label: 'Orta Risk'
    },
    high: {
      bg: 'bg-[#F44336]/20',
      text: 'text-[#F44336]',
      border: 'border-[#F44336]/30',
      label: 'Yüksek Risk'
    }
  };

  const variant = variants[normalizedLevel] || variants.medium;

  return (
    <span className={cn(
      'inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border',
      variant.bg,
      variant.text,
      variant.border,
      className
    )}>
      {variant.label}
    </span>
  );
}

