'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Eski arşiv URL'leri → sohbet sekmesine yönlendir */
export default function StandaloneArchiveRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';

  useEffect(() => {
    if (!id) {
      router.replace('/standalone');
      return;
    }
    const chatId = id === 'session-active' ? null : id;
    if (chatId) {
      router.replace(`/standalone?chat=${chatId}`);
    } else {
      router.replace('/standalone');
    }
  }, [id, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-stone-500">Sohbete yönlendiriliyor…</p>
    </div>
  );
}
