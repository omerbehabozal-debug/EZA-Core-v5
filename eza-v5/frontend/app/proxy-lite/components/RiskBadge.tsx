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
      bg: 'bg-[#39FF88]/20',
      text: 'text-[#39FF88]',
      border: 'border-[#39FF88]/30',
      label: 'Düşük Risk'
    },
    medium: {
      bg: 'bg-[#FFC93C]/20',
      text: 'text-[#FFC93C]',
      border: 'border-[#FFC93C]/30',
      label: 'Orta Risk'
    },
    high: {
      bg: 'bg-[#FF3B3B]/20',
      text: 'text-[#FF3B3B]',
      border: 'border-[#FF3B3B]/30',
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

