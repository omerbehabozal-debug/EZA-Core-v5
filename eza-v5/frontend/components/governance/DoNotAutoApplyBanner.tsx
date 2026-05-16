'use client';

import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DoNotAutoApplyBannerProps {
  disclaimer?: string;
  className?: string;
}

export default function DoNotAutoApplyBanner({
  disclaimer = 'Bu öneriler otomatik uygulanmaz. Yalnızca admin kalibrasyonu içindir.',
  className,
}: DoNotAutoApplyBannerProps) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950',
        className
      )}
      role="status"
    >
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-semibold">Otomatik uygulama kapalı</p>
        <p className="mt-0.5 text-xs sm:text-sm text-amber-900/90">{disclaimer}</p>
      </div>
    </div>
  );
}
