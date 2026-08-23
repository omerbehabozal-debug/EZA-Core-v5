'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';
import type { AuthorPublishedYansiItem } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { ownerVisibilityLabel } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  setYansiVisibility,
  unpublishYansi,
} from '@/lib/eza/mirror-network/yansiTrustActions';
import {
  applyOwnerYansiUnpublishedLocally,
  noteOwnerYansiSlugPublication,
} from '@/lib/eza/mirror/journey';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';

type Props = {
  item: AuthorPublishedYansiItem;
  isOwner: boolean;
  onOwnerMutated?: () => void;
};

/**
 * Phase 8.5B — profile Yansı card: visual → title → conversation summary.
 * No Instagram tiles. No Phase 6.2 popularity metrics on profile.
 */
export default function ProfileYansiCard({
  item,
  isOwner,
  onOwnerMutated,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const href = `/m/${encodeURIComponent(item.slug)}`;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const runOwnerAction = async (action: 'public' | 'unlisted' | 'unpublish') => {
    setBusy(true);
    setMessage(null);
    const result =
      action === 'unpublish'
        ? await unpublishYansi(item.slug)
        : await setYansiVisibility(item.slug, action);
    setBusy(false);
    if (!result.ok) {
      setMessage('İşlem tamamlanamadı. Biraz sonra tekrar dene.');
      return;
    }
    if (action === 'unpublish') {
      applyOwnerYansiUnpublishedLocally(item.slug);
    } else {
      noteOwnerYansiSlugPublication(item.slug, {
        visibility: action,
        safetyStatus: item.safetyStatus,
      });
    }
    setMenuOpen(false);
    onOwnerMutated?.();
  };

  return (
    <li
      className="bilign-profile-card-wrap"
      data-testid="author-published-item"
      data-profile-yansi-card
    >
      <YansiExposureRoot
        slug={item.slug}
        journeyVersion={item.journeyVersion ?? null}
        context="public_profile"
      >
        <Link
          href={href}
          className="bilign-profile-card-link"
          data-testid={`profile-yansi-link-${item.slug}`}
        >
          <MirrorPublicCard
            title={item.publicTitle}
            summary={item.publicSummary}
            sceneImageUrl={item.sceneImageUrl}
            slug={item.slug}
            testIdPrefix="bilign-profile-card"
            loadingLazy
            className="bilign-profile-card"
          />
        </Link>
      </YansiExposureRoot>

      {isOwner ? (
        <div className="bilign-profile-card-owner" ref={menuRef}>
          <span
            className="bilign-profile-visibility-chip"
            data-testid={`profile-visibility-chip-${item.slug}`}
          >
            {ownerVisibilityLabel(item)}
          </span>
          <button
            type="button"
            className="bilign-profile-overflow-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${item.publicTitle} yönetim menüsü`}
            data-testid={`profile-overflow-${item.slug}`}
            disabled={busy}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div
              className="bilign-profile-overflow-menu"
              role="menu"
              data-testid={`profile-overflow-menu-${item.slug}`}
            >
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runOwnerAction('public')}
              >
                Herkese açık yap
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runOwnerAction('unlisted')}
              >
                Bağlantıyla bırak
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runOwnerAction('unpublish')}
              >
                Yayından kaldır
              </button>
            </div>
          ) : null}
          {message ? (
            <p className="bilign-profile-owner-msg" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
