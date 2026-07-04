'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SAINA_DISCOVER_EMPTY_BODY,
  SAINA_DISCOVER_EMPTY_TITLE,
  SAINA_DISCOVER_ERROR,
  SAINA_DISCOVER_ERROR_RETRY,
  SAINA_DISCOVER_HERO_LINE_1,
  SAINA_DISCOVER_HERO_LINE_2,
  SAINA_DISCOVER_TITLE,
} from '@/lib/eza/mirror-network/discoverCopy';
import {
  fetchDiscoverMirrors,
  type DiscoverMirror,
} from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import SainaDiscoverList from '@/components/saina/SainaDiscoverList';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';

export default function SainaDiscoverPage() {
  const router = useRouter();
  const chrome = useSainaChromeStore();
  const [items, setItems] = useState<DiscoverMirror[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useSyncSainaChrome({
    activeSection: 'discover',
    conversations: chrome.conversations,
    conversationGroups: chrome.conversationGroups,
    activeChatId: chrome.activeChatId,
    conversationSceneUrl: chrome.conversationSceneUrl,
    planTier: chrome.planTier,
    onNewChat: chrome.onNewChat,
    onSelectChat: chrome.onSelectChat,
    onDeleteChat: chrome.onDeleteChat,
    onOpenPattern: chrome.onOpenPattern,
    onUpgrade: chrome.onUpgrade,
    onRequestLogin: chrome.onRequestLogin,
    safeOnlyMode: chrome.safeOnlyMode ?? false,
    onSafeOnlyModeChange: chrome.onSafeOnlyModeChange,
    analysisModelId: chrome.analysisModelId ?? 'default',
    onAnalysisModelChange: chrome.onAnalysisModelChange,
    settingsDisabled: chrome.settingsDisabled,
    onOpenMirror: chrome.onOpenMirror,
    notifications: chrome.notifications,
  });

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    setError(false);
    const result = await fetchDiscoverMirrors({ limit: 24, revalidateSeconds: 0 });
    if (!result.ok) {
      setError(true);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

  return (
    <div className="saina-discover-page" data-testid="saina-discover-page">
      <header className="saina-discover-hero">
        <p className="saina-discover-eyebrow">{SAINA_DISCOVER_TITLE}</p>
        <h1 className="saina-discover-headline saina-serif">{SAINA_DISCOVER_HERO_LINE_1}</h1>
        <p className="saina-discover-subhead">{SAINA_DISCOVER_HERO_LINE_2}</p>
      </header>

      {error ? (
        <div className="saina-discover-state saina-discover-state--error" role="alert">
          <p className="saina-discover-state__title">{SAINA_DISCOVER_ERROR}</p>
          <p className="saina-discover-state__body">{SAINA_DISCOVER_ERROR_RETRY}</p>
          <button type="button" className="saina-discover-retry" onClick={() => void loadDiscover()}>
            Tekrar dene
          </button>
        </div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div className="saina-discover-state" data-testid="saina-discover-empty">
          <p className="saina-discover-state__title">{SAINA_DISCOVER_EMPTY_TITLE}</p>
          <p className="saina-discover-state__body">{SAINA_DISCOVER_EMPTY_BODY}</p>
          <button
            type="button"
            className="saina-discover-retry"
            onClick={() => router.push('/standalone')}
          >
            Sohbete git
          </button>
        </div>
      ) : null}

      {!error && (loading || items.length > 0) ? (
        <SainaDiscoverList items={items} loading={loading} />
      ) : null}
    </div>
  );
}
