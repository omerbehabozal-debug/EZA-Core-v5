'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  MINI_MIRROR_ENERGY_LABEL,
  MINI_MIRROR_LOCKED_HEADING,
  MINI_MIRROR_PERSONA_PREFIX,
  MINI_MIRROR_THEME_LABEL,
  MINI_MIRROR_TOMORROW_LABEL,
  PLAN_UPGRADE_CTA,
} from '@/lib/eza/mirror/copy';
import LockedTeaserTile from '@/components/plan/LockedTeaserTile';
import UpgradeModal from '@/components/plan/UpgradeModal';

export interface MiniMirrorCardProps {
  card: DailyMirrorCardModel;
  className?: string;
}

const LOCKED_FEATURES = ['Sen', 'AI', 'Denge', 'Görsel Sahne', 'Tam Poster', 'Paylaşım'];

/**
 * Free plan — sade, persona-merkezli günlük ayna.
 * Mevcut DailyMirrorCardModel'den türetilmiş alanları gösterir;
 * hiçbir üretim mantığına dokunmaz.
 */
export default function MiniMirrorCard({ card, className }: MiniMirrorCardProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const content = useMemo(() => buildPosterCardContent(card), [card]);

  const openUpgrade = () => setUpgradeOpen(true);

  return (
    <div
      className={cn(
        'flex w-full max-w-[min(100%,26rem)] flex-col gap-6 rounded-[28px] border border-white/60 bg-white/80 px-6 py-8 shadow-[0_24px_70px_-32px_rgba(99,102,241,0.4)] backdrop-blur-xl sm:px-8',
        className
      )}
    >
      {/* Persona — kartın yıldızı */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-stone-400">
          {MINI_MIRROR_PERSONA_PREFIX}
        </span>
        <h2
          className={cn(
            'bg-gradient-to-r bg-clip-text text-2xl font-semibold tracking-[-0.02em] text-transparent sm:text-[1.7rem]',
            content.characterGradient
          )}
        >
          {card.characterName}
        </h2>
        <span
          className="mt-1 text-5xl leading-none drop-shadow-[0_8px_20px_rgba(99,102,241,0.25)] sm:text-6xl"
          role="img"
          aria-label={card.characterName}
        >
          {content.characterEmoji}
        </span>
      </div>

      {/* Kısa hikâye */}
      {content.storyLine ? (
        <p className="text-center text-[15px] leading-relaxed text-stone-600">
          {content.storyLine}
        </p>
      ) : null}

      {/* Tema + Enerji */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-200/60 bg-white/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            {MINI_MIRROR_THEME_LABEL}
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-stone-800">
            {content.themeTitle}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/60 bg-white/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            {MINI_MIRROR_ENERGY_LABEL}
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-stone-800">
            {content.energyDisplay}
          </p>
        </div>
      </div>

      {/* Yarının ipucu */}
      {card.tomorrowHint ? (
        <div className="rounded-2xl border border-violet-100/70 bg-violet-50/50 px-4 py-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-violet-400">
            {MINI_MIRROR_TOMORROW_LABEL}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{card.tomorrowHint}</p>
        </div>
      ) : null}

      {/* Plus teaser alanı */}
      <div className="flex flex-col gap-3 border-t border-stone-200/60 pt-5">
        <p className="text-center text-[12px] font-medium uppercase tracking-[0.14em] text-stone-400">
          {MINI_MIRROR_LOCKED_HEADING}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {LOCKED_FEATURES.map((label) => (
            <LockedTeaserTile key={label} label={label} onUpgrade={openUpgrade} />
          ))}
        </div>
        <button
          type="button"
          onClick={openUpgrade}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
        >
          {PLAN_UPGRADE_CTA}
        </button>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        feature="daily_mirror_full"
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}
