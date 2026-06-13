'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, Search, Sparkles } from 'lucide-react';
import {
  SAINA_COMMAND_ACTION_NEW_CHAT,
  SAINA_COMMAND_ACTION_OPEN_MIRROR,
  SAINA_COMMAND_ACTION_PATTERN,
  SAINA_COMMAND_DIALOG_LABEL,
  SAINA_COMMAND_NO_RESULTS,
  SAINA_COMMAND_QUICK_ACTIONS,
  SAINA_COMMAND_RECENT_CHATS,
  SAINA_COMMAND_SEARCH_PLACEHOLDER,
} from '@/lib/eza/sainaCopy';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';
import SainaGeometricMark from './SainaGeometricMark';

export type SainaCommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  conversations?: SainaConversationItem[];
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onOpenMirror?: () => void;
  onOpenPattern?: () => void;
};

function filterConversations(items: SainaConversationItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)
  );
}

export default function SainaCommandPalette({
  open,
  onClose,
  conversations = [],
  onNewChat,
  onSelectChat,
  onOpenMirror,
  onOpenPattern,
}: SainaCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterConversations(conversations, query),
    [conversations, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runAndClose = (action?: () => void) => {
    action?.();
    onClose();
  };

  return (
    <div className="saina-command-palette-root" data-testid="saina-command-palette-root">
      <button
        type="button"
        className="saina-command-palette-backdrop"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        className="saina-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={SAINA_COMMAND_DIALOG_LABEL}
        data-testid="saina-command-palette"
      >
        <div className="saina-command-palette-search">
          <Search size={18} className="saina-command-palette-search-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={SAINA_COMMAND_SEARCH_PLACEHOLDER}
            className="saina-command-palette-input"
            aria-label={SAINA_COMMAND_SEARCH_PLACEHOLDER}
            data-testid="saina-command-palette-input"
          />
        </div>

        <div className="saina-command-palette-section">
          <p className="saina-command-palette-section-label">{SAINA_COMMAND_QUICK_ACTIONS}</p>
          <div className="saina-command-palette-actions">
            <button
              type="button"
              className="saina-command-palette-action"
              data-testid="saina-command-action-new-chat"
              onClick={() => runAndClose(onNewChat)}
            >
              <MessageSquarePlus size={16} aria-hidden />
              <span>{SAINA_COMMAND_ACTION_NEW_CHAT}</span>
            </button>
            <button
              type="button"
              className="saina-command-palette-action"
              data-testid="saina-command-action-open-mirror"
              onClick={() => runAndClose(onOpenMirror)}
            >
              <Sparkles size={16} aria-hidden />
              <span>{SAINA_COMMAND_ACTION_OPEN_MIRROR}</span>
            </button>
            <button
              type="button"
              className="saina-command-palette-action"
              data-testid="saina-command-action-pattern"
              onClick={() => runAndClose(onOpenPattern)}
            >
              <SainaGeometricMark size={16} variant="gold" />
              <span>{SAINA_COMMAND_ACTION_PATTERN}</span>
            </button>
          </div>
        </div>

        <div className="saina-command-palette-section saina-command-palette-section--scroll">
          <p className="saina-command-palette-section-label">{SAINA_COMMAND_RECENT_CHATS}</p>
          {filtered.length === 0 ? (
            <p className="saina-command-palette-empty">{SAINA_COMMAND_NO_RESULTS}</p>
          ) : (
            <ul className="saina-command-palette-list">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="saina-command-palette-chat"
                    data-testid={`saina-command-chat-${item.id}`}
                    onClick={() => runAndClose(() => onSelectChat?.(item.id))}
                  >
                    <span className="saina-command-palette-chat-title">{item.title}</span>
                    <span className="saina-command-palette-chat-preview">{item.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
