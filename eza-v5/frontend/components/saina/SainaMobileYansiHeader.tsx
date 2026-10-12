'use client';

/**
 * Mobile Yansı overlay header — menu + compact author + quiet meta + overflow.
 * Desktop top bar / identity block remain unchanged.
 */

import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import type { PublicHonorificId } from '@/lib/eza/mirror/publicHonorific';
import {
  SAINA_MENU_GUEST_LABEL,
} from '@/lib/eza/sainaCopy';

export type SainaMobileYansiHeaderProps = {
  displayName?: string | null;
  honorificId?: PublicHonorificId | null;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarCacheBust?: number | string;
  /** Quiet meta — server-known conversation time (e.g. "3 gün önce"). */
  metaTimeLabel?: string | null;
  /** Quiet meta — content type (e.g. "Yeni sohbet", "Yansı"). */
  metaTypeLabel?: string | null;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  profileOpen?: boolean;
  onOpenSettings?: () => void;
  className?: string;
};

export default function SainaMobileYansiHeader({
  displayName,
  honorificId = null,
  userId = null,
  avatarUrl = null,
  avatarCacheBust,
  metaTimeLabel = null,
  metaTypeLabel = null,
  onOpenMenu,
  onOpenProfile,
  profileOpen = false,
  className,
}: SainaMobileYansiHeaderProps) {
  const name = displayName?.trim() || SAINA_MENU_GUEST_LABEL;
  const timeLabel = metaTimeLabel?.trim() || '';
  const typeLabel = metaTypeLabel?.trim() || '';
  const showMeta = Boolean(timeLabel || typeLabel);
  const identityInteractive = typeof onOpenProfile === 'function';

  const identityBody = (
    <>
      <ProfileUserAvatar
        displayName={name}
        userId={userId}
        avatarUrl={avatarUrl}
        cacheBust={avatarCacheBust}
        size="sm"
        className="saina-mobile-yansi-header__avatar"
      />
      <div className="saina-mobile-yansi-header__copy">
        <span className="saina-mobile-yansi-header__name">{name}</span>
        {honorificId ? (
          <HonorificMarker honorific={honorificId} testId="saina-mobile-yansi-honorific" />
        ) : null}
      </div>
    </>
  );

  return (
    <header
      className={cn('saina-mobile-yansi-header', className)}
      data-testid="saina-mobile-yansi-header"
    >
      <div className="saina-mobile-yansi-header__row">
        <button
          type="button"
          className="saina-mobile-yansi-header__menu"
          data-testid="saina-mobile-menu-btn"
          onClick={onOpenMenu}
          aria-label="Menü"
        >
          <Menu size={20} aria-hidden />
        </button>

        {identityInteractive ? (
          <button
            type="button"
            className="saina-mobile-yansi-header__author"
            data-testid="saina-mobile-yansi-author"
            aria-label="Hesabım"
            onClick={onOpenProfile}
          >
            {identityBody}
          </button>
        ) : (
          <div
            className="saina-mobile-yansi-header__author"
            data-testid="saina-mobile-yansi-author"
          >
            {identityBody}
          </div>
        )}

        <button
          type="button"
          className="saina-mobile-yansi-header__more saina-mobile-profile-trigger"
          data-testid="saina-mobile-profile-trigger"
          aria-label="Profil ve ayarlar"
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
        >
          <ProfileUserAvatar
            displayName={name}
            userId={userId}
            avatarUrl={avatarUrl}
            cacheBust={avatarCacheBust}
            size="sm"
            className="saina-mobile-yansi-header__avatar"
          />
        </button>
      </div>

      {showMeta ? (
        <p className="saina-mobile-yansi-header__meta" data-testid="saina-mobile-yansi-meta">
          {timeLabel ? (
            <span data-testid="saina-mobile-yansi-meta-time">{timeLabel}</span>
          ) : null}
          {timeLabel && typeLabel ? (
            <span className="saina-mobile-yansi-header__meta-sep" aria-hidden="true">
              {' '}
              ·{' '}
            </span>
          ) : null}
          {typeLabel ? (
            <span data-testid="saina-mobile-yansi-meta-type">{typeLabel}</span>
          ) : null}
        </p>
      ) : null}
    </header>
  );
}
