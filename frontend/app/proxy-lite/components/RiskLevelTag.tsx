/**
 * Risk Level Tag Component
 */

import { cn } from '@/lib/utils';

interface RiskLevelTagProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

export default function RiskLevelTag({ level, className }: RiskLevelTagProps) {
  const variants = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    low: 'Düşük Risk',
    medium: 'Orta Risk',
    high: 'Yüksek Risk',
    critical: 'Kritik Risk',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
      variants[level],
      className
    )}>
      {labels[level]}
    </span>
  );
}

