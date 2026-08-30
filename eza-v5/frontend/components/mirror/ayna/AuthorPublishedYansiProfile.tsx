'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAuthorPublishedYansilar,
  fetchOwnerProfileYansilar,
  mergeProfileItemsBySlug,
  PROFILE_YANSI_PAGE_SIZE,
  type AuthorPublishedYansiItem,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import ProfileEditSheet from '@/components/mirror/ayna/ProfileEditSheet';
import ProfileYansiCard from '@/components/mirror/ayna/ProfileYansiCard';
import { useResolvedProfileAvatar } from '@/hooks/useResolvedProfileAvatar';

type Props = {
  userId: string;
};

type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Phase 8.5B — biligN public/owner profile.
 * Quiet identity + Yansı cards (visual → title → summary). No social graph.
 * Phase 8.5B.1 — load-more in-flight guard + slug dedupe.
 */
export default function AuthorPublishedYansiProfile({ userId }: Props) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const ownershipResolved = isAuthReady;
  const isOwner =
    ownershipResolved &&
    Boolean(isAuthenticated && user?.user_id && user.user_id === userId.trim());

  const [displayName, setDisplayName] = useState(PUBLIC_DISPLAY_NAME_FALLBACK);
  const [honorific, setHonorific] = useState<string | null>(null);
  const [publicAvatarUrl, setPublicAvatarUrl] = useState<string | null>(null);
  const [publicAvatarRevision, setPublicAvatarRevision] = useState<number | null>(null);
  const [items, setItems] = useState<AuthorPublishedYansiItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadMoreInFlightRef = useRef(false);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!ownershipResolved) return;
      if (append) {
        if (loadMoreInFlightRef.current) return;
        loadMoreInFlightRef.current = true;
        setLoadingMore(true);
      } else {
        setStatus('loading');
      }

      try {
        const result = isOwner
          ? await fetchOwnerProfileYansilar({
              limit: PROFILE_YANSI_PAGE_SIZE,
              offset,
            })
          : await fetchAuthorPublishedYansilar(userId, {
              limit: PROFILE_YANSI_PAGE_SIZE,
              offset,
            });

        if (!result.ok) {
          if (!append) setStatus('error');
          return;
        }

        setDisplayName(result.data.displayName);
        setHonorific(result.data.publicHonorific ?? 'curious');
        setPublicAvatarUrl(result.data.publicAvatarUrl ?? null);
        setPublicAvatarRevision(result.data.publicAvatarRevision ?? null);
        setTotal(result.data.total);
        setItems((prev) =>
          append
            ? mergeProfileItemsBySlug(prev, result.data.items)
            : result.data.items
        );
        if (!append) {
          setStatus(
            result.data.items.length === 0 && result.data.total === 0
              ? 'empty'
              : 'ready'
          );
        } else {
          setStatus('ready');
        }
      } finally {
        if (append) {
          loadMoreInFlightRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [isOwner, ownershipResolved, userId]
  );

  useEffect(() => {
    if (!ownershipResolved) {
      setStatus('loading');
      return;
    }
    void loadPage(0, false);
  }, [ownershipResolved, isOwner, userId, reloadKey, loadPage]);

  const hasMore = items.length < total;
  const showEmpty = status === 'empty' || (status === 'ready' && items.length === 0);
  const resolvedAvatar = useResolvedProfileAvatar({
    subjectUserId: userId,
    publicAvatarUrl,
    publicAvatarRevision,
  });

  return (
    <main
      className="bilign-profile"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
      data-testid="author-published-profile"
      data-profile-owner={isOwner ? 'true' : 'false'}
      data-auth-ready={ownershipResolved ? 'true' : 'false'}
    >
      {!ownershipResolved || status === 'loading' ? (
        <div className="bilign-profile-skeleton" data-testid="bilign-profile-skeleton">
          <div className="bilign-profile-skeleton__avatar" />
          <div className="bilign-profile-skeleton__name" />
          <div className="bilign-profile-skeleton__card" />
          <div className="bilign-profile-skeleton__card" />
        </div>
      ) : null}

      {ownershipResolved && status !== 'loading' ? (
        <>
          <header className="bilign-profile-header">
            <ProfileUserAvatar
              displayName={displayName}
              userId={userId}
              avatarUrl={resolvedAvatar.url}
              cacheBust={resolvedAvatar.revision}
              size="lg"
            />
            <h1
              className="bilign-profile-name"
              data-testid="bilign-profile-display-name"
            >
              {displayName}
            </h1>
            <HonorificMarker
              honorific={honorific}
              className="bilign-profile-honorific"
              testId="bilign-profile-honorific"
            />
            {isOwner ? (
              <button
                ref={editTriggerRef}
                type="button"
                className="bilign-profile-edit-trigger"
                onClick={() => setEditOpen(true)}
                data-testid="bilign-profile-edit-trigger"
              >
                Profili düzenle
              </button>
            ) : null}
          </header>

          <h2 className="bilign-profile-section-label">Yansılar</h2>

          {status === 'error' ? (
            <div className="bilign-profile-state" role="status">
              <p>Profil şu an açılamıyor.</p>
              <button
                type="button"
                className="bilign-profile-retry"
                onClick={() => setReloadKey((k) => k + 1)}
                data-testid="bilign-profile-retry"
              >
                Tekrar dene
              </button>
            </div>
          ) : null}

          {showEmpty ? (
            <p
              className="bilign-profile-state"
              role="status"
              data-testid="bilign-profile-empty"
            >
              {isOwner
                ? 'Henüz bir Yansı yok. Sohbetinden ilk Yansını oluşturabilirsin.'
                : 'Henüz herkese açık Yansı yok.'}
            </p>
          ) : null}

          {status === 'ready' && items.length > 0 ? (
            <ul
              className="bilign-profile-grid"
              data-testid="author-published-list"
            >
              {items.map((item) => (
                <ProfileYansiCard
                  key={item.slug}
                  item={item}
                  isOwner={isOwner}
                  onOwnerMutated={() => setReloadKey((k) => k + 1)}
                />
              ))}
            </ul>
          ) : null}

          {hasMore && status === 'ready' ? (
            <button
              type="button"
              className="bilign-profile-load-more"
              disabled={loadingMore}
              onClick={() => void loadPage(items.length, true)}
              data-testid="bilign-profile-load-more"
            >
              {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
            </button>
          ) : null}
        </>
      ) : null}

      {isOwner ? (
        <ProfileEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initialName={displayName}
          onSaved={(name) => setDisplayName(name)}
          returnFocusRef={editTriggerRef}
        />
      ) : null}
    </main>
  );
}
