/**
 * SafetyBadge Component - Premium Apple Chip Design
 */

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface SafetyBadgeProps {
  safety: 'Safe' | 'Warning' | 'Blocked';
}

export default function SafetyBadge({ safety }: SafetyBadgeProps) {
  const badgeConfig = {
    Safe: {
      bg: 'bg-green-50/80',
      text: 'text-green-700',
      border: 'border-green-200/50',
      icon: CheckCircle2,
      label: 'Safe'
    },
    Warning: {
      bg: 'bg-amber-50/80',
      text: 'text-amber-700',
      border: 'border-amber-200/50',
      icon: AlertTriangle,
      label: 'Warning'
    },
    Blocked: {
      bg: 'bg-red-50/80',
      text: 'text-red-700',
      border: 'border-red-200/50',
      icon: XCircle,
      label: 'Blocked'
    }
  };

  const config = badgeConfig[safety];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 min-h-[20px] rounded-full text-[10px] font-medium border whitespace-nowrap ${config.bg} ${config.text} ${config.border}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
