'use client';

/**
 * Slice 5 — Merakıma ekle / Meraklarımda control (active slug authority).
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  YANSI_SAVE_ADD,
  YANSI_SAVE_SAVED,
} from '@/lib/eza/mirror/copy';
import { saveYansi, unsaveYansi, fetchYansiSaveState } from '@/lib/eza/mirror-network/yansiSaveApi';
import {
  getYansiSaveStoreVersion,
  hydrateYansiSaveStore,
  isYansiSavePending,
  isYansiSavedInStore,
  noteYansiSaveState,
  setYansiSavePending,
  subscribeYansiSaveStore,
} from '@/lib/eza/mirror-network/yansiSaveStore';
import { setPendingYansiSaveIntent } from '@/lib/eza/mirror-network/yansiSavePendingIntent';
import { cn } from '@/lib/utils';

export type YansiSaveButtonProps = {
  slug: string;
  authorUserId?: string | null;
  className?: string;
  /** Open IdentityModal when guest presses Save. */
  onRequireAuth?: () => void;
};

export default function YansiSaveButton({
  slug,
  authorUserId,
  className,
  onRequireAuth,
}: YansiSaveButtonProps) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const saveTick = useSyncExternalStore(
    subscribeYansiSaveStore,
    getYansiSaveStoreVersion,
    () => 0
  );
  void saveTick;

  const activeSlug = slug.trim().toLowerCase();
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    Boolean(isAuthenticated && user?.user_id && authorUserId) &&
    user!.user_id === authorUserId;

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !activeSlug || isOwner) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchYansiSaveState(activeSlug);
      if (cancelled || !result.ok) return;
      // Drop stale responses after navigation.
      if (result.slug !== activeSlug) return;
      noteYansiSaveState(result.slug, result.saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSlug, isAuthReady, isAuthenticated, isOwner]);

  const saved = isYansiSavedInStore(activeSlug);
  const pending = isYansiSavePending(activeSlug);

  const onToggle = useCallback(async () => {
    if (!activeSlug || pending) return;
    setError(null);

    if (!isAuthenticated) {
      setPendingYansiSaveIntent(activeSlug);
      onRequireAuth?.();
      return;
    }
    if (isOwner) return;

    const nextSaved = !saved;
    setYansiSavePending(activeSlug, nextSaved ? 'save' : 'unsave');
    noteYansiSaveState(activeSlug, nextSaved);

    const requestedSlug = activeSlug;
    const result = nextSaved
      ? await saveYansi(requestedSlug)
      : await unsaveYansi(requestedSlug);

    setYansiSavePending(requestedSlug, null);

    if (!result.ok) {
      // Revert only if still on the same slug.
      if (requestedSlug === activeSlug) {
        noteYansiSaveState(requestedSlug, !nextSaved);
        setError(
          result.code === 'self_save_not_allowed'
            ? 'Kendi Yansını kaydedemezsin.'
            : 'Kaydedilemedi. Biraz sonra tekrar dene.'
        );
      }
      return;
    }

    // Stale response after navigation — do not apply to a different active slug.
    if (result.slug !== activeSlug) {
      // Keep store consistent for the requested slug only.
      noteYansiSaveState(result.slug, result.saved);
      return;
    }

    noteYansiSaveState(result.slug, result.saved);
    void hydrateYansiSaveStore();
  }, [
    activeSlug,
    pending,
    isAuthenticated,
    isOwner,
    saved,
    onRequireAuth,
  ]);

  if (!isAuthReady) return null;
  if (isOwner) return null;
  if (!activeSlug) return null;

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        className="yansi-save-btn inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-medium text-[#f5ead8] transition-colors hover:bg-white/10"
        data-testid="yansi-save-button"
        data-slug={activeSlug}
        data-saved={saved ? 'true' : 'false'}
        data-pending={pending ? 'true' : 'false'}
        aria-pressed={saved}
        aria-label={saved ? YANSI_SAVE_SAVED : YANSI_SAVE_ADD}
        disabled={pending}
        onClick={() => void onToggle()}
      >
        <Heart
          size={14}
          strokeWidth={1.6}
          aria-hidden
          fill={saved ? 'currentColor' : 'none'}
        />
        <span>{saved ? YANSI_SAVE_SAVED : YANSI_SAVE_ADD}</span>
      </button>
      {error ? (
        <p className="text-[11px] text-[#c9a890]" data-testid="yansi-save-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
