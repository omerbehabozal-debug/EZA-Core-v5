'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { cn } from '@/lib/utils';

export type NewChatGroupPickerProps = {
  open: boolean;
  groups: ConversationGroup[];
  onClose: () => void;
  onSelectExisting: (groupId: string) => void;
  onCreateNew: (title: string) => void | Promise<void>;
  onContinueUngrouped: () => void;
  creating?: boolean;
  error?: string | null;
};

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase('tr');
}

export default function NewChatGroupPicker({
  open,
  groups,
  onClose,
  onSelectExisting,
  onCreateNew,
  onContinueUngrouped,
  creating = false,
  error = null,
}: NewChatGroupPickerProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (!trimmed) return groups;
    const q = normalizeTitle(trimmed);
    return groups.filter((g) => normalizeTitle(g.title).includes(q));
  }, [groups, trimmed]);

  const exactMatch = useMemo(() => {
    if (!trimmed) return null;
    const q = normalizeTitle(trimmed);
    return groups.find((g) => normalizeTitle(g.title) === q) ?? null;
  }, [groups, trimmed]);

  const showCreate = Boolean(trimmed) && !exactMatch && !creating;

  if (!open) return null;

  const handleCreate = () => {
    if (!trimmed || creating || exactMatch) return;
    void onCreateNew(trimmed);
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
              Bu sohbet nerede ilerlesin?
            </h2>
            <p className="mt-1 text-sm text-[#a89f92]">
              Bir grup ara veya yeni bir grup adı yaz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#8a8074] hover:bg-white/5 hover:text-[#e8dfd0]"
            aria-label="Kapat"
            disabled={creating}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor="new-group-search" className="sr-only">
          Grup ara veya oluştur
        </label>
        <input
          id="new-group-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (exactMatch) {
                onSelectExisting(exactMatch.id);
              } else {
                handleCreate();
              }
            }
          }}
          placeholder="Grup adı yaz…"
          disabled={creating}
          className="w-full rounded-xl border border-white/10 bg-[#0c0b0a] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#6f675c] focus:border-[#e8d5b5]/30 focus:outline-none disabled:opacity-60"
          data-testid="new-chat-group-search-input"
          autoFocus
        />

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {matches.map((group) => (
            <button
              key={group.id}
              type="button"
              disabled={creating}
              className="w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-[#e8dfd0] hover:border-white/20 hover:bg-white/5 disabled:opacity-60"
              onClick={() => onSelectExisting(group.id)}
              data-testid={`new-chat-group-existing-${group.id}`}
            >
              {group.title}
            </button>
          ))}

          {showCreate ? (
            <button
              type="button"
              className="w-full rounded-xl border border-[#e8d5b5]/25 bg-[#e8d5b5]/8 px-4 py-3 text-left text-sm font-medium text-[#f5ead8] hover:border-[#e8d5b5]/40"
              onClick={handleCreate}
              data-testid="new-chat-group-create-submit"
            >
              “{trimmed}” grubunu oluştur
            </button>
          ) : null}

          {!trimmed && groups.length === 0 ? (
            <p className="px-1 py-2 text-sm text-[#8a8074]">Henüz grup yok. Yeni bir ad yazabilirsin.</p>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[#e8a090]" data-testid="new-chat-group-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={creating}
          className={cn(
            'mt-4 w-full rounded-full border border-white/10 px-4 py-2.5 text-sm text-[#a89f92] hover:border-white/20 hover:text-[#e8dfd0]',
            creating && 'opacity-50'
          )}
          onClick={onContinueUngrouped}
          data-testid="new-chat-group-ungrouped"
        >
          Grupsuz devam et
        </button>
      </div>
    </div>
  );
}
