'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_NOTIFICATIONS_EMPTY,
  SAINA_NOTIFICATIONS_EMPTY_NOTE,
  SAINA_NOTIFICATIONS_TITLE,
} from '@/lib/eza/sainaCopy';

export type SainaNotificationItem = {
  id: string;
  title: string;
  body: string;
  type?: string;
  createdAt?: string;
};

export type SainaNotificationsDropdownProps = {
  notifications?: SainaNotificationItem[];
  className?: string;
};

export default function SainaNotificationsDropdown({
  notifications = [],
  className,
}: SainaNotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasItems = notifications.length > 0;

  return (
    <div ref={rootRef} className={cn('saina-notifications-root', className)}>
      <button
        type="button"
        className="saina-icon-btn saina-icon-btn--glass saina-notifications-trigger"
        aria-label={hasItems ? 'Bildirimler, yeni bildirim var' : 'Bildirimler'}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="saina-notifications-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} />
        {hasItems ? (
          <span className="saina-notifications-badge" aria-hidden data-testid="saina-notifications-badge" />
        ) : null}
      </button>

      {open ? (
        <div
          className="saina-notifications-panel"
          role="menu"
          aria-label={SAINA_NOTIFICATIONS_TITLE}
          data-testid="saina-notifications-panel"
        >
          <p className="saina-notifications-title">{SAINA_NOTIFICATIONS_TITLE}</p>
          {hasItems ? (
            <ul className="saina-notifications-list">
              {notifications.map((item) => (
                <li key={item.id} className="saina-notifications-item">
                  <p className="saina-notifications-item-title">{item.title}</p>
                  <p className="saina-notifications-item-body">{item.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="saina-notifications-empty" data-testid="saina-notifications-empty">
              <p className="saina-notifications-empty-title">{SAINA_NOTIFICATIONS_EMPTY}</p>
              <p className="saina-notifications-empty-note">{SAINA_NOTIFICATIONS_EMPTY_NOTE}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
