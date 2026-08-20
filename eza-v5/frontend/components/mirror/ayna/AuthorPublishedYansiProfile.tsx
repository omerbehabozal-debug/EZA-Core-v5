'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAuthorPublishedYansilar,
  type AuthorPublishedYansiItem,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { parseYansiPublicSocialProofInput } from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';
import { YansiPublicMetricsView } from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import { useAuth } from '@/context/AuthContext';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import { apiClient } from '@/lib/apiClient';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';

function ProfileYansiMetrics({ item }: { item: AuthorPublishedYansiItem }) {
  const canonical = parseYansiPublicSocialProofInput(item);
  if (!canonical) return null;
  return (
    <YansiPublicMetricsView
      experienceStartedCount={canonical.experienceStartedCount}
      directChildYansiCount={canonical.directChildYansiCount}
      slug={item.slug}
      journeyVersion={item.journeyVersion ?? undefined}
      className="pt-1 text-stone-500"
      variant="section"
    />
  );
}

type OwnerItem = AuthorPublishedYansiItem & {
  visibility?: string | null;
  safetyStatus?: string | null;
  isPublicListable?: boolean | null;
};

type Props = {
  userId: string;
};

function visibilityLabel(item: OwnerItem): string {
  if (item.isPublicListable) return 'Herkese açık';
  const vis = (item.visibility || '').toLowerCase();
  if (vis === 'unlisted') return 'Bağlantıyla';
  if (vis === 'private') return 'Gizli / çekilmiş';
  return vis || 'Gizli';
}

/**
 * Public profile — published Yansılar only. No follow/follower semantics.
 * Owner viewing own UUID also sees non-public inventory (Phase 8.5).
 */
export default function AuthorPublishedYansiProfile({ userId }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isOwner =
    Boolean(isAuthenticated && user?.user_id && user.user_id === userId.trim());
  const [displayName, setDisplayName] = useState(PUBLIC_DISPLAY_NAME_FALLBACK);
  const [items, setItems] = useState<AuthorPublishedYansiItem[]>([]);
  const [ownerItems, setOwnerItems] = useState<OwnerItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void (async () => {
      if (isOwner) {
        const response = await apiClient.get<{
          displayName?: string;
          items?: OwnerItem[];
          total?: number;
        }>('/api/mirror-network/me/profile-yansilar', {
          auth: true,
          timeoutMs: 15_000,
        });
        if (cancelled) return;
        if (!response.ok) {
          setStatus('error');
          return;
        }
        const data = (response.data ?? response) as {
          displayName?: string;
          items?: OwnerItem[];
        };
        setDisplayName(
          typeof data.displayName === 'string' && data.displayName.trim()
            ? data.displayName
            : PUBLIC_DISPLAY_NAME_FALLBACK
        );
        const list = Array.isArray(data.items) ? data.items : [];
        setOwnerItems(list);
        setItems(list.filter((row) => row.isPublicListable));
        setStatus(list.length ? 'ready' : 'empty');
        return;
      }

      const result = await fetchAuthorPublishedYansilar(userId);
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      setDisplayName(result.data.displayName);
      setItems(result.data.items);
      setOwnerItems([]);
      setStatus(result.data.items.length ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isOwner]);

  const listForPublic = isOwner ? items : items;
  const showOwnerInventory = isOwner && ownerItems.length > 0;

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-4 py-8"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
      data-testid="author-published-profile"
    >
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Yayınlanan Yansılar
        </p>
        <h1 className="mt-2 font-serif text-2xl text-stone-900">{displayName}</h1>
        <p className="mt-2 text-sm text-stone-600">
          {isOwner
            ? 'Başkaları yalnızca herkese açık Yansılarınızı ve seçtiğiniz adı görür.'
            : 'Bu kişinin dünyaya açtığı Yansılar.'}
        </p>
        {isOwner ? (
          <p className="mt-1 text-xs text-stone-500" data-testid="owner-profile-url-hint">
            Profil bağlantınız: {authorProfilePath(userId)}
          </p>
        ) : null}
      </header>

      {status === 'loading' ? (
        <p className="text-sm text-stone-500" role="status">
          Yükleniyor…
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="text-sm text-stone-500" role="status">
          Profil şu an açılamıyor.
        </p>
      ) : null}
      {status === 'empty' && !showOwnerInventory ? (
        <p className="text-sm text-stone-500" role="status">
          Henüz yayınlanmış Yansı yok.
        </p>
      ) : null}

      {showOwnerInventory ? (
        <section data-testid="owner-profile-inventory">
          <h2 className="text-sm font-medium text-stone-800">Yansılarınız</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {ownerItems.map((item) => (
              <li
                key={item.slug}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/m/${encodeURIComponent(item.slug)}`}
                    className="text-sm font-medium text-stone-900 hover:underline"
                  >
                    {item.publicTitle}
                  </Link>
                  <span className="shrink-0 text-xs text-stone-500">
                    {visibilityLabel(item)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isOwner && status === 'ready' ? (
        <ul className="flex flex-col gap-4" data-testid="author-published-list">
          {listForPublic.map((item) => (
            <li key={item.slug}>
              <YansiExposureRoot
                slug={item.slug}
                journeyVersion={item.journeyVersion ?? null}
                context="public_profile"
              >
              <Link
                href={`/m/${encodeURIComponent(item.slug)}`}
                className="block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
                data-testid="author-published-item"
              >
                {item.sceneImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.sceneImageUrl}
                    alt=""
                    className="aspect-[4/5] w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="space-y-1 p-4">
                  <h2 className="text-base font-medium text-stone-900">
                    {item.publicTitle}
                  </h2>
                  {item.publicSummary ? (
                    <p className="line-clamp-3 text-sm text-stone-600">
                      {item.publicSummary}
                    </p>
                  ) : null}
                  <ProfileYansiMetrics item={item} />
                </div>
              </Link>
              </YansiExposureRoot>
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner && listForPublic.length > 0 ? (
        <section data-testid="author-published-list">
          <h2 className="text-sm font-medium text-stone-800">
            Başkalarının gördüğü
          </h2>
          <ul className="mt-3 flex flex-col gap-4">
            {listForPublic.map((item) => (
              <li key={`public-${item.slug}`}>
                <Link
                  href={`/m/${encodeURIComponent(item.slug)}`}
                  className="block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
                  data-testid="author-published-item"
                >
                  <div className="space-y-1 p-4">
                    <h2 className="text-base font-medium text-stone-900">
                      {item.publicTitle}
                    </h2>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
