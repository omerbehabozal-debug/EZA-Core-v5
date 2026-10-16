'use client';

import '@/styles/saina-my-page.css';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Bookmark, Layers } from 'lucide-react';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import { useAuth } from '@/context/AuthContext';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { fetchOwnerProfileYansilar, mergeProfileItemsBySlug, PROFILE_YANSI_PAGE_SIZE, type AuthorPublishedYansiItem,
  type OwnerProfileYansiResponse } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { fetchMySavedYansilar, type SavedYansiListItem } from '@/lib/eza/mirror-network/yansiSaveApi';
import { getYansiSaveStoreVersion, subscribeYansiSaveStore } from '@/lib/eza/mirror-network/yansiSaveStore';
import { isActiveOwnerPublication, ownerPublicationCard, savedPublicationCard } from '@/lib/eza/mirror-network/myPageYansilar';
import { SAINA_DISCOVER_ROUTE, SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';
import { CHATS_UPDATED_EVENT } from '@/lib/standaloneChatArchive';
import SainaDiscoverCard from './SainaDiscoverCard';
import SainaYansiSaveControl from './SainaYansiSaveControl';

type CollectionState<T> = { account: string; loading: boolean; error: boolean; data: T };

export default function SainaMyPageContent({ onRequireAuth }: { onRequireAuth: () => void }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const account = isAuthenticated ? user?.user_id ?? null : null;
  const [tab, setTab] = useState<'published' | 'saved'>('published');
  const [refresh, setRefresh] = useState(0);
  const [owner, setOwner] = useState<CollectionState<OwnerProfileYansiResponse | null> | null>(null);
  const [saved, setSaved] = useState<CollectionState<SavedYansiListItem[]> | null>(null);
  const saveVersion = useSyncExternalStore(subscribeYansiSaveStore, getYansiSaveStoreVersion, () => 0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    window.addEventListener('focus', reload);
    window.addEventListener(CHATS_UPDATED_EVENT, reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener(CHATS_UPDATED_EVENT, reload); };
  }, []);

  useEffect(() => {
    if (!isAuthReady || !account) return;
    let cancelled = false;
    setOwner({ account, loading: true, error: false, data: null });
    void (async () => {
      let response: OwnerProfileYansiResponse | null = null;
      let merged: AuthorPublishedYansiItem[] = [];
      let offset = 0;
      for (;;) {
        const result = await fetchOwnerProfileYansilar({ limit: PROFILE_YANSI_PAGE_SIZE, offset });
        if (cancelled) return;
        if (!result.ok || result.data.userId !== account) throw new Error('owner_inventory_failed');
        merged = mergeProfileItemsBySlug(merged, result.data.items);
        response = { ...result.data, items: merged };
        offset += result.data.items.length;
        if (result.data.items.length < PROFILE_YANSI_PAGE_SIZE || offset >= result.data.total) break;
      }
      if (!cancelled) setOwner({ account, loading: false, error: false, data: response });
    })().catch(() => { if (!cancelled) setOwner({ account, loading: false, error: true, data: null }); });
    return () => { cancelled = true; };
  }, [account, isAuthReady, refresh]);

  useEffect(() => {
    if (!isAuthReady || !account || tab !== 'saved') return;
    let cancelled = false;
    setSaved((previous) => ({ account, loading: true, error: false,
      data: previous?.account === account ? previous.data : [] }));
    void (async () => {
      const items: SavedYansiListItem[] = [];
      const seen = new Set<string>();
      let offset = 0;
      for (;;) {
        const result = await fetchMySavedYansilar({ limit: 48, offset });
        if (cancelled) return;
        if (!result.ok) throw new Error('saved_inventory_failed');
        for (const item of result.data.items) {
          if (!seen.has(item.slug)) { seen.add(item.slug); items.push(item); }
        }
        offset += result.data.items.length;
        if (result.data.items.length < 48 || offset >= result.data.total) break;
      }
      if (!cancelled) setSaved({ account, loading: false, error: false, data: items });
    })().catch(() => { if (!cancelled) setSaved({ account, loading: false, error: true, data: [] }); });
    return () => { cancelled = true; };
  }, [account, isAuthReady, tab, saveVersion, refresh]);

  const currentOwner = account && owner?.account === account ? owner : null;
  const currentSaved = account && saved?.account === account ? saved : null;
  const inventory = tab === 'published' ? currentOwner : currentSaved;
  const publications = currentOwner?.data?.items.filter(isActiveOwnerPublication) ?? [];
  const name = currentOwner?.data?.displayName || user?.public_display_name?.trim() ||
    (account ? 'BiligN kullanıcısı' : 'biligN Guest');

  return <div className="saina-discover-content-scroll">
    <section className="saina-discover-page saina-my-page" data-testid="saina-my-page">
      <header className="saina-discover-hero saina-my-page__hero">
        <div className="saina-my-page__identity">
          <ProfileUserAvatar displayName={name} userId={account} avatarUrl={user?.public_avatar_url}
            cacheBust={user?.public_avatar_revision} size="lg" className="saina-my-page__avatar saina-mobile-yansi-header__avatar" />
          <div className="saina-my-page__identity-copy">
            <h1 className="saina-my-page__name saina-serif saina-mobile-yansi-header__name">{name}</h1>
            {account && (currentOwner?.data?.publicHonorific || user?.public_honorific) ?
              <HonorificMarker honorific={currentOwner?.data?.publicHonorific || user?.public_honorific} size="sm" /> : null}
            <p className="saina-my-page__intro">Meraklarımın izleri.</p>
          </div>
        </div>
      </header>
      <div className="saina-my-page__tabs" role="tablist" aria-label="Yansı koleksiyonları">
        {(['published', 'saved'] as const).map((value, index) => <button key={value} type="button" role="tab"
          ref={(element) => { tabRefs.current[index] = element; }} id={`my-page-tab-${value}`}
          aria-controls="my-page-collection" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
          onClick={() => setTab(value)} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
            setTab(next === 0 ? 'published' : 'saved'); tabRefs.current[next]?.focus();
          }}>{value === 'published' ? 'Yansılarım' : 'Kaydettiklerim'}</button>)}
      </div>
      <div id="my-page-collection" className="saina-discover-list-scroll" role="tabpanel"
        aria-labelledby={`my-page-tab-${tab}`} aria-busy={Boolean(account && (!inventory || inventory.loading))}>
        {!isAuthReady ? <p role="status">Oturum kontrol ediliyor…</p> : !account ?
          <div className="saina-discover-state"><p>Yansılarını ve kaydettiklerini görmek için giriş yap.</p>
            <button type="button" className="saina-discover-retry" onClick={onRequireAuth}>Giriş yap</button></div> :
          !inventory || inventory.loading ? <p role="status">Yansılar yükleniyor…</p> : inventory.error ?
          <div className="saina-discover-state" role="alert"><p>Yansılar alınamadı.</p>
            <button className="saina-discover-retry" onClick={() => setRefresh((value) => value + 1)}>Tekrar dene</button></div> :
          (tab === 'published' ? publications.length === 0 : currentSaved?.data.length === 0) ?
          <div className="saina-my-page__empty" data-testid={`my-page-empty-${tab}`}>
            {tab === 'published' ? <Layers size={26} aria-hidden /> : <Bookmark size={26} aria-hidden />}
            <h2>{tab === 'published' ? 'Henüz yayımladığın bir Yansı yok.' : 'Henüz kaydettiğin bir Yansı yok'}</h2>
            <p>{tab === 'published' ? 'Yayımladığın Yansılar burada yer alacak.' : 'İlgini çeken Yansıları kaydettiğinde burada bulabilirsin.'}</p>
            <Link className="saina-my-page__empty-cta" href={tab === 'published' ? SAINA_NEW_CHAT_ROUTE : SAINA_DISCOVER_ROUTE}>
              {tab === 'published' ? 'Yeni sohbet' : "Keşfet’e git"}<ArrowRight size={16} aria-hidden />
            </Link>
          </div> :
          <div className="saina-discover-list">
            {tab === 'published' && currentOwner?.data ? publications.map((item) =>
              <SainaDiscoverCard key={item.slug} item={ownerPublicationCard(item, currentOwner.data!)} showSave={false} presentation="owner-publication" />) :
              currentSaved?.data.map((item) => {
                const card = savedPublicationCard(item);
                return card ? <SainaDiscoverCard key={item.slug} item={card} authorUserId={item.authorUserId} showSave /> :
                  <div key={item.slug} className="saina-my-page__unavailable" data-testid="my-page-unavailable">
                    <p>Bu Yansı artık erişilebilir değil.</p><SainaYansiSaveControl slug={item.slug} unavailable />
                  </div>;
              })}
          </div>}
      </div>
    </section>
  </div>;
}
