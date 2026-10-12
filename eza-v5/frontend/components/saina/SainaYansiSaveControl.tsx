'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { fetchYansiSaveState, saveYansi, unsaveYansi } from '@/lib/eza/mirror-network/yansiSaveApi';
import { getYansiSaveStoreVersion, isYansiSavedInStore, isYansiSavePending, noteYansiSaveState,
  setYansiSavePending, subscribeYansiSaveStore } from '@/lib/eza/mirror-network/yansiSaveStore';

/** Collection controls share the existing account-authenticated Save API and Reel store. */
export default function SainaYansiSaveControl({ slug, authorUserId, unavailable = false }: {
  slug: string; authorUserId?: string | null; unavailable?: boolean;
}) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const account = isAuthenticated ? user?.user_id ?? null : null;
  const key = slug.trim().toLowerCase();
  const currentAccount = useRef(account);
  const requestEpoch = useRef(0);
  const ownsPending = useRef(false);
  currentAccount.current = account;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  useSyncExternalStore(subscribeYansiSaveStore, getYansiSaveStoreVersion, () => 0);
  const owner = Boolean(account && account === authorUserId);

  useEffect(() => {
    let cancelled = false;
    setLoadedFor(null);
    setFeedback('');
    if (!account || owner) return;
    if (unavailable) { setLoadedFor(account); return; }
    void fetchYansiSaveState(key).then((result) => {
      if (cancelled || currentAccount.current !== account) return;
      if (!result.ok || result.slug !== key) { setFeedback('Kayıt durumu alınamadı.'); return; }
      if (isYansiSavedInStore(key) !== result.saved) noteYansiSaveState(key, result.saved);
      setLoadedFor(account);
    }).catch(() => { if (!cancelled) setFeedback('Kayıt durumu alınamadı.'); });
    return () => { cancelled = true; };
  }, [account, key, owner, unavailable]);

  useEffect(() => {
    requestEpoch.current += 1;
    return () => {
      requestEpoch.current += 1;
      if (ownsPending.current) { setYansiSavePending(key, null); ownsPending.current = false; }
    };
  }, [account, key]);

  const saved = unavailable || (loadedFor === account && isYansiSavedInStore(key));
  const pending = isYansiSavePending(key);
  const toggle = async () => {
    if (!account) { useSainaChromeStore.getState().onRequestLogin?.(); return; }
    if (owner || loadedFor !== account || isYansiSavePending(key)) return;
    const next = !saved;
    const epoch = requestEpoch.current;
    ownsPending.current = true;
    setYansiSavePending(key, next ? 'save' : 'unsave');
    setFeedback('');
    try {
      const result = next ? await saveYansi(key) : await unsaveYansi(key);
      if (currentAccount.current !== account || requestEpoch.current !== epoch) return;
      if (!result.ok) {
        setFeedback(result.code === 'self_save_not_allowed' ? 'Kendi Yansını kaydedemezsin.' : 'İşlem tamamlanamadı. Tekrar dene.');
        return;
      }
      noteYansiSaveState(key, result.saved);
      setFeedback(result.saved ? 'Meraklarına kaydedildi.' : 'Meraklarından çıkarıldı.');
    } catch {
      if (currentAccount.current === account && requestEpoch.current === epoch) setFeedback('İşlem tamamlanamadı. Tekrar dene.');
    } finally {
      if (currentAccount.current === account && requestEpoch.current === epoch) {
        ownsPending.current = false;
        setYansiSavePending(key, null);
      }
    }
  };
  if (!isAuthReady || owner) return null;
  return <div className="saina-collection-save">
    <button type="button" className="saina-collection-save__button" data-testid={`saina-save-${key}`}
      aria-pressed={Boolean(saved)} disabled={pending || Boolean(account && loadedFor !== account)} onClick={() => void toggle()}>
      <Heart size={14} aria-hidden fill={saved ? 'currentColor' : 'none'} />
      {saved ? 'Meraklarımdan çıkar' : 'Meraklarıma kaydet'}
    </button>
    <span role="status" className="saina-collection-save__feedback">{feedback}</span>
  </div>;
}
