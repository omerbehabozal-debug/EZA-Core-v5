'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  MIRROR_PATTERN_REDIRECT,
  MIRROR_PATTERN_REDIRECT_LINK,
  MIRROR_PATTERN_ROUTE,
  PLAN_UPGRADE_CTA,
  PLAN_UPGRADE_LOGIN_CTA,
  MIRROR_SCENE_LOGIN_HINT,
} from '@/lib/eza/mirror/copy';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const ms = standaloneSkin.mirrorSurface;

const actionBtnClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-full border border-violet-200/50 bg-violet-50/90 px-5 py-2.5 text-xs font-medium tracking-tight text-violet-900',
  'transition-colors hover:border-violet-300/60 hover:bg-violet-100/90',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50'
);

export type DailyMirrorReadyFooterProps = {
  ephemeralNote: string;
  secondaryHint?: string;
  plusQuotaHint?: string;
  sceneStatusHint?: string;
  showFreeUpgradePrimary?: boolean;
  onUpgrade?: () => void;
  showLoginPrimary?: boolean;
  onLogin?: () => void;
  className?: string;
};

export default function DailyMirrorReadyFooter({
  ephemeralNote,
  secondaryHint,
  plusQuotaHint,
  sceneStatusHint,
  showFreeUpgradePrimary = false,
  onUpgrade,
  showLoginPrimary = false,
  onLogin,
  className,
}: DailyMirrorReadyFooterProps) {
  return (
    <div className={cn('flex w-full max-w-sm flex-col items-center gap-2.5', className)}>
      {sceneStatusHint ? (
        <p
          className={cn(ms.sceneWrap, 'text-center text-[11px] font-medium text-amber-800/90')}
          role="status"
        >
          {sceneStatusHint}
        </p>
      ) : null}
      <p className={cn(ms.sceneWrap, 'text-center text-[11px] leading-relaxed text-stone-500')}>
        {ephemeralNote}
      </p>
      {secondaryHint ? (
        <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>{secondaryHint}</p>
      ) : null}
      {plusQuotaHint ? (
        <p
          className={cn(ms.sceneWrap, 'text-center text-[11px] font-medium text-violet-700/85')}
          role="status"
        >
          {plusQuotaHint}
        </p>
      ) : null}
      <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
        {MIRROR_PATTERN_REDIRECT}{' '}
        <Link
          href={MIRROR_PATTERN_ROUTE}
          className="font-medium text-violet-700/90 underline decoration-violet-300/60 underline-offset-2 hover:text-violet-900"
        >
          {MIRROR_PATTERN_REDIRECT_LINK}
        </Link>
      </p>
      {showLoginPrimary && onLogin ? (
        <>
          <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
            {MIRROR_SCENE_LOGIN_HINT}
          </p>
          <button type="button" onClick={onLogin} className={actionBtnClass}>
            {PLAN_UPGRADE_LOGIN_CTA}
          </button>
        </>
      ) : null}
      {showFreeUpgradePrimary && onUpgrade ? (
        <button type="button" onClick={onUpgrade} className={actionBtnClass}>
          {PLAN_UPGRADE_CTA}
        </button>
      ) : null}
    </div>
  );
}
