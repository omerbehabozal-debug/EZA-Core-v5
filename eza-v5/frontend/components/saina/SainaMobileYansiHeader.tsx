'use client';

/**
 * Mobile Yansı overlay header — menu + compact author + quiet meta + overflow.
 * Desktop top bar / identity block remain unchanged.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Menu, MoreHorizontal, Search, Bell, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import type { PublicHonorificId } from '@/lib/eza/mirror/publicHonorific';
import {
  SAINA_MENU_GUEST_LABEL,
  SAINA_MENU_SETTINGS,
  SAINA_NOTIFICATIONS_TITLE,
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
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
  onOpenSettings,
  className,
}: SainaMobileYansiHeaderProps) {
  const name = displayName?.trim() || SAINA_MENU_GUEST_LABEL;
  const timeLabel = metaTimeLabel?.trim() || '';
  const typeLabel = metaTypeLabel?.trim() || '';
  const showMeta = Boolean(timeLabel || typeLabel);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const identityInteractive = typeof onOpenProfile === 'function';

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
      ref={rootRef}
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

        <div className="saina-mobile-yansi-header__overflow">
          <button
            type="button"
            className="saina-mobile-yansi-header__more"
            data-testid="saina-mobile-yansi-overflow"
            aria-label="Daha fazla"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              className="saina-mobile-yansi-header__menu-panel"
              role="menu"
              data-testid="saina-mobile-yansi-overflow-menu"
            >
              {onOpenSearch ? (
                <button
                  type="button"
                  role="menuitem"
                  className="saina-mobile-yansi-header__menu-item"
                  data-testid="saina-mobile-overflow-search"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSearch();
                  }}
                >
                  <Search size={14} aria-hidden />
                  Ara
                </button>
              ) : null}
              {onOpenNotifications ? (
                <button
                  type="button"
                  role="menuitem"
                  className="saina-mobile-yansi-header__menu-item"
                  data-testid="saina-mobile-overflow-notifications"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenNotifications();
                  }}
                >
                  <Bell size={14} aria-hidden />
                  {SAINA_NOTIFICATIONS_TITLE}
                </button>
              ) : null}
              {onOpenSearch || onOpenNotifications ? (
                onOpenProfile || onOpenSettings ? (
                  <div
                    className="saina-mobile-yansi-header__menu-sep"
                    role="separator"
                    data-testid="saina-mobile-overflow-sep"
                  />
                ) : null
              ) : null}
              {onOpenProfile ? (
                <button
                  type="button"
                  role="menuitem"
                  className="saina-mobile-yansi-header__menu-item"
                  data-testid="saina-mobile-overflow-profile"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                >
                  <User size={14} aria-hidden />
                  Hesabım
                </button>
              ) : null}
              {onOpenSettings ? (
                <button
                  type="button"
                  role="menuitem"
                  className="saina-mobile-yansi-header__menu-item"
                  data-testid="saina-mobile-overflow-settings"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <Settings size={14} aria-hidden />
                  {SAINA_MENU_SETTINGS}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
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
