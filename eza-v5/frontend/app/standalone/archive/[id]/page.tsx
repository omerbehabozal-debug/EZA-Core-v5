'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import ChatBubble from '@/components/standalone/ChatBubble';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { deleteChatArchive, getChatArchive, type ArchivedChat } from '@/lib/standaloneChatArchive';

export default function StandaloneArchivePage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';
  const [archive, setArchive] = useState<ArchivedChat | null>(null);

  useEffect(() => {
    if (!id) return;
    setArchive(getChatArchive(id));
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    deleteChatArchive(id);
    router.push('/standalone');
  };

  if (!archive) {
    return (
      <div className={standaloneSkin.page}>
        <StandalonePageShell>
          <div className="mx-auto max-w-2xl px-4 py-12 text-center">
            <p className="text-sm text-standalone-text-secondary">Arşiv kaydı bulunamadı.</p>
            <Link href="/standalone" className="mt-3 inline-block text-sm text-standalone-primary">
              Sohbete dön
            </Link>
          </div>
        </StandalonePageShell>
      </div>
    );
  }

  return (
    <div className={standaloneSkin.page}>
      <StandalonePageShell>
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[780px] flex-col px-3 py-4 sm:px-4 sm:py-6">
          <header className="mb-4 shrink-0 border-b border-standalone-border/50 pb-3">
            <Link
              href="/standalone"
              className="text-[13px] font-medium text-standalone-primary hover:underline"
            >
              ← Yeni sohbet
            </Link>
            <h1 className="mt-2 truncate text-base font-semibold text-standalone-text">
              {archive.title}
            </h1>
            <p className="mt-0.5 text-[11px] text-standalone-text-muted">
              {new Date(archive.savedAt).toLocaleString('tr-TR')} · {archive.messageCount} mesaj
            </p>
            <button
              type="button"
              onClick={handleDelete}
              className="mt-2 flex items-center gap-1 text-xs text-red-600/90 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Arşivden sil
            </button>
          </header>

          <div className={`${standaloneSkin.listInnerActive} min-h-0 flex-1 overflow-y-auto pb-6`}>
            {archive.messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message.text}
                isUser={message.isUser}
                userScore={message.userScore}
                assistantScore={message.assistantScore}
                timestamp={message.timestamp ? new Date(message.timestamp) : undefined}
              />
            ))}
          </div>
        </div>
      </StandalonePageShell>
    </div>
  );
}
