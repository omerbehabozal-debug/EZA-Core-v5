'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAuthorPublishedYansilar,
  type AuthorPublishedYansiItem,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';

type Props = {
  userId: string;
};

/**
 * Public profile — published Yansılar only. No follow/follower semantics.
 */
export default function AuthorPublishedYansiProfile({ userId }: Props) {
  const [displayName, setDisplayName] = useState('Yazar');
  const [items, setItems] = useState<AuthorPublishedYansiItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void (async () => {
      const result = await fetchAuthorPublishedYansilar(userId);
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      setDisplayName(result.data.displayName);
      setItems(result.data.items);
      setStatus(result.data.items.length ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
          Bu kişinin dünyaya açtığı Yansılar.
        </p>
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
      {status === 'empty' ? (
        <p className="text-sm text-stone-500" role="status">
          Henüz yayınlanmış Yansı yok.
        </p>
      ) : null}

      {status === 'ready' ? (
        <ul className="flex flex-col gap-4" data-testid="author-published-list">
          {items.map((item) => (
            <li key={item.slug}>
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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
