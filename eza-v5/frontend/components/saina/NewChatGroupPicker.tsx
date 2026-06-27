'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { cn } from '@/lib/utils';

export type NewChatGroupPickerProps = {
  open: boolean;
  groups: ConversationGroup[];
  onClose: () => void;
  onSelectExisting: (groupId: string) => void;
  onCreateNew: (title: string) => void;
};

export default function NewChatGroupPicker({
  open,
  groups,
  onClose,
  onSelectExisting,
  onCreateNew,
}: NewChatGroupPickerProps) {
  const [mode, setMode] = useState<'choose' | 'new'>('choose');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) {
      setMode('choose');
      setTitle('');
    }
  }, [open]);

  if (!open) return null;

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateNew(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-group-title"
      data-testid="new-chat-group-picker"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141210] p-5 text-[#f4f0e8] shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="new-chat-group-title" className="text-base font-semibold text-[#f4f0e8]">
              Bu sohbet hangi başlığın altında ilerlesin?
            </h2>
            <p className="mt-1 text-sm text-[#a89f92]">Sohbetlerim altında düzenlenecek.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#8a8074] hover:bg-white/5 hover:text-[#e8dfd0]"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'choose' ? (
          <div className="space-y-2">
            <button
              type="button"
              className="w-full rounded-xl border border-[#e8d5b5]/25 bg-[#e8d5b5]/8 px-4 py-3 text-left text-sm font-medium text-[#f5ead8] hover:border-[#e8d5b5]/40"
              onClick={() => setMode('new')}
              data-testid="new-chat-group-create"
            >
              Yeni başlık oluştur
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-[#e8dfd0] hover:border-white/20 hover:bg-white/5"
                onClick={() => onSelectExisting(group.id)}
                data-testid={`new-chat-group-existing-${group.id}`}
              >
                {group.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="new-group-title" className="sr-only">
              Yeni başlık
            </label>
            <input
              id="new-group-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Japonya, Mimarlık, Otomobiller"
              className="w-full rounded-xl border border-white/10 bg-[#0c0b0a] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#6f675c] focus:border-[#e8d5b5]/30 focus:outline-none"
              data-testid="new-chat-group-title-input"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-sm text-[#a89f92]"
                onClick={() => setMode('choose')}
              >
                Geri
              </button>
              <button
                type="button"
                disabled={!title.trim()}
                className={cn(
                  'flex-1 rounded-full border border-[#e8d5b5]/25 bg-[#e8d5b5]/10 px-4 py-2.5 text-sm font-semibold text-[#f5ead8]',
                  !title.trim() && 'opacity-50'
                )}
                onClick={handleCreate}
                data-testid="new-chat-group-submit"
              >
                Oluştur ve başla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
