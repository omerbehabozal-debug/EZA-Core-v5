'use client';

import { cn } from '@/lib/utils';
import { MIRROR_ONBOARDING_PREVIEW_LABEL } from '@/lib/eza/mirror/copy';

interface ExampleCard {
  name: string;
  emoji: string;
  theme: string;
  gradient: string;
}

/** Statik, açıklayıcı örnekler — gerçek veri değil, ürünü anlatmak için. */
const EXAMPLE_CARDS: ExampleCard[] = [
  {
    name: 'Şefkatli Geyik',
    emoji: '🦌',
    theme: 'Dostluk & Uyum',
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-500',
  },
  {
    name: 'Sakin Panda',
    emoji: '🐼',
    theme: 'Düşünce & Denge',
    gradient: 'from-violet-400 via-indigo-400 to-violet-600',
  },
  {
    name: 'Araştıran & Detaycı',
    emoji: '🔍',
    theme: 'Keşif & Ufuk',
    gradient: 'from-sky-400 via-blue-400 to-indigo-500',
  },
];

export interface MirrorOnboardingPreviewProps {
  className?: string;
}

export default function MirrorOnboardingPreview({ className }: MirrorOnboardingPreviewProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
        {MIRROR_ONBOARDING_PREVIEW_LABEL}
      </span>
      <ul className="grid w-full grid-cols-3 gap-2.5">
        {EXAMPLE_CARDS.map((card) => (
          <li
            key={card.name}
            className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200/60 bg-white/65 px-2 py-4 text-center backdrop-blur-sm"
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-2xl shadow-[0_8px_20px_-10px_rgba(99,102,241,0.5)]',
                card.gradient
              )}
              role="img"
              aria-label={card.name}
            >
              {card.emoji}
            </span>
            <span className="text-[12px] font-semibold leading-tight tracking-tight text-stone-700">
              {card.name}
            </span>
            <span className="text-[10px] leading-tight text-stone-400">{card.theme}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
