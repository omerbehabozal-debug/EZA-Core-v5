/**
 * Score Badge Component
 */

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export default function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 50) return 'bg-yellow-500 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <div className={cn(
      'inline-flex items-center justify-center w-20 h-20 rounded-full font-bold text-xl',
      getColor(),
      className
    )}>
      {score}
    </div>
  );
}

