/**
 * SafetyBadge Component - Premium Apple Chip Design
 */

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface SafetyBadgeProps {
  safety: 'Safe' | 'Warning' | 'Blocked';
  confidence?: number;
}

export default function SafetyBadge({ safety, confidence }: SafetyBadgeProps) {
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
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 min-h-[26px] rounded-full text-xs font-medium border backdrop-blur-md shadow-sm ${config.bg} ${config.text} ${config.border}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
      {confidence !== undefined && (
        <span className="text-xs text-gray-500 font-medium">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}
