'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchPublishedChildren,
  type AuthorPublishedYansiItem,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';

type Props = {
  parentSlug: string;
};

/**
 * Direct published child Yansılar — curiosity branches, not followers.
 */
export default function ParentChildrenYansiList({ parentSlug }: Props) {
  const [parentTitle, setParentTitle] = useState<string | null>(null);
  const [items, setItems] = useState<AuthorPublishedYansiItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void (async () => {
      const result = await fetchPublishedChildren(parentSlug);
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      setParentTitle(result.data.parentTitle ?? null);
      setItems(result.data.items);
      setStatus(result.data.items.length ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [parentSlug]);

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-4 py-8"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
      data-testid="parent-children-yansi-list"
    >
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Devam Yansıları
        </p>
        <h1 className="mt-2 font-serif text-2xl text-stone-900">
          {parentTitle || 'Bu Yansından büyüyenler'}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Bu Yansıdan devam edilerek yayınlanan doğrudan Yansılar.
        </p>
        <Link
          href={`/m/${encodeURIComponent(parentSlug)}`}
          className="mt-3 inline-block text-sm text-stone-700 underline-offset-2 hover:underline"
        >
          Üst Yansıya dön
        </Link>
      </header>

      {status === 'loading' ? (
        <p className="text-sm text-stone-500" role="status">
          Yükleniyor…
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="text-sm text-stone-500" role="status">
          Devam Yansıları şu an açılamıyor.
        </p>
      ) : null}
      {status === 'empty' ? (
        <p className="text-sm text-stone-500" role="status">
          Henüz yayınlanmış devam Yansı yok.
        </p>
      ) : null}

      {status === 'ready' ? (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/m/${encodeURIComponent(item.slug)}`}
                className="block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
                data-testid="parent-child-item"
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
