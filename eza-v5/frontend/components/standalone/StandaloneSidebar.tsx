'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Pin,
  Search,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  CHATS_UPDATED_EVENT,
  deleteChatArchive,
  listChatArchives,
  renameChat,
  setChatPinned,
  summarizeArchiveTitle,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { MIRROR_ROUTE, MIRROR_SIDEBAR_LABEL } from '@/lib/eza/mirror/copy';

type ChatGroup = { label: string; items: ArchivedChatSummary[] };

/** Sohbetleri sabitlenenler + tarih bucket'larına ayırır (sadece görüntüleme). */
function groupChatsByDate(chats: ArchivedChatSummary[]): ChatGroup[] {
  const pinned = chats.filter((c) => c.pinned);
  const rest = chats.filter((c) => !c.pinned);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  const startOfYesterday = startOfToday - dayMs;
  const startOfWeek = startOfToday - 6 * dayMs;

  const today: ArchivedChatSummary[] = [];
  const yesterday: ArchivedChatSummary[] = [];
  const week: ArchivedChatSummary[] = [];
  const older: ArchivedChatSummary[] = [];

  for (const c of rest) {
    const t = new Date(c.savedAt).getTime();
    if (Number.isNaN(t) || t >= startOfToday) today.push(c);
    else if (t >= startOfYesterday) yesterday.push(c);
    else if (t >= startOfWeek) week.push(c);
    else older.push(c);
  }

  const groups: ChatGroup[] = [];
  if (pinned.length) groups.push({ label: 'Sabitlenenler', items: pinned });
  if (today.length) groups.push({ label: 'Bugün', items: today });
  if (yesterday.length) groups.push({ label: 'Dün', items: yesterday });
  if (week.length) groups.push({ label: 'Bu Hafta', items: week });
  if (older.length) groups.push({ label: 'Daha Eski', items: older });
  return groups;
}

interface StandaloneSidebarProps {
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  hasActiveChat?: boolean;
  onNewChat?: () => void;
}

export default function StandaloneSidebar({
  safeOnlyMode,
  onSafeOnlyModeChange,
  mobileOpen,
  onMobileClose,
  onNewChat,
}: StandaloneSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams?.get('chat') ?? null;
  const [chats, setChats] = useState<ArchivedChatSummary[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const refreshChats = useCallback(() => {
    setChats(listChatArchives());
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? chats.filter((c) => (c.title || '').toLowerCase().includes(q))
      : chats;
    return groupChatsByDate(filtered);
  }, [chats, query]);

  const handlePinToggle = (e: React.MouseEvent, item: ArchivedChatSummary) => {
    e.preventDefault();
    e.stopPropagation();
    setChatPinned(item.id, !item.pinned);
    refreshChats();
  };

  const startRename = (e: React.MouseEvent, item: ArchivedChatSummary) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (next) renameChat(editingId, next);
    setEditingId(null);
    setEditingTitle('');
    refreshChats();
  }, [editingId, editingTitle, refreshChats]);

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    refreshChats();
    window.addEventListener(CHATS_UPDATED_EVENT, refreshChats);
    window.addEventListener('focus', refreshChats);
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, refreshChats);
      window.removeEventListener('focus', refreshChats);
    };
  }, [refreshChats, pathname]);

  const navActive = (href: string) =>
    pathname != null && (pathname === href || pathname.startsWith(`${href}/`));

  const handleDeleteChat = (e: React.MouseEvent, item: ArchivedChatSummary) => {
    e.preventDefault();
    e.stopPropagation();
    const label = summarizeArchiveTitle(item.title) || 'Bu sohbet';
    if (!window.confirm(`"${label}" silinsin mi?`)) return;

    deleteChatArchive(item.id);

    if (activeChatId === item.id) {
      const remaining = listChatArchives();
      if (remaining.length > 0) {
        router.push(`/standalone?chat=${remaining[0]!.id}`);
      } else {
        // Boş kayıt açma; temiz bir taslakla /standalone'a dön.
        router.push('/standalone');
      }
    }
    refreshChats();
  };

  const handleNewChatClick = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Lazy: boş sohbet oluşturmadan taslak başlatmak için /standalone'a git.
      router.push('/standalone');
    }
    onMobileClose();
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          aria-label="Menüyü kapat"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          standaloneSkin.sidebar,
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
          'lg:relative lg:inset-auto lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Yan menü"
      >
        <div className={standaloneSkin.sidebarInner}>
          <div className="flex items-start justify-between gap-1">
            <div className={standaloneSkin.sidebarBrandBlock}>
              <p className={standaloneSkin.sidebarLogo}>EZA</p>
              <p className={standaloneSkin.sidebarProduct}>Standalone</p>
            </div>
            <button
              type="button"
              onClick={onMobileClose}
              className={cn(standaloneSkin.iconBtn, 'lg:hidden')}
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewChatClick}
            className={standaloneSkin.sidebarNewChatBtn}
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0 opacity-60" />
            Yeni sohbet
          </button>

          <nav className={standaloneSkin.sidebarNav} aria-label="Gezinme">
            <Link
              href="/standalone"
              onClick={onMobileClose}
              className={cn(
                standaloneSkin.sidebarNavItem,
                pathname === '/standalone' ? 'bg-white/80 text-standalone-text' : ''
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
              Sohbet
            </Link>
            <Link
              href={MIRROR_ROUTE}
              onClick={onMobileClose}
              className={cn(
                standaloneSkin.sidebarNavItem,
                navActive(MIRROR_ROUTE) ||
                  navActive('/standalone/reports') ||
                  navActive('/standalone/insights')
                  ? 'bg-white/80 text-standalone-text'
                  : ''
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0 opacity-60" />
              {MIRROR_SIDEBAR_LABEL}
            </Link>

            {chats.length > 0 ? (
              <div className={standaloneSkin.sidebarSearchWrap}>
                <span className={standaloneSkin.sidebarSearchIcon}>
                  <Search className="h-3.5 w-3.5" aria-hidden />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sohbetlerde ara…"
                  aria-label="Sohbetlerde ara"
                  className={standaloneSkin.sidebarSearchInput}
                />
              </div>
            ) : null}

            <p className={standaloneSkin.sidebarSectionLabel}>Sohbetler</p>

            {chats.length === 0 ? (
              <div className={standaloneSkin.sidebarEmptyState}>
                <MessageSquare className={cn(standaloneSkin.sidebarEmptyIcon, 'h-7 w-7')} aria-hidden />
                <p className={standaloneSkin.sidebarEmptyTitle}>Henüz sohbetin yok</p>
                <p className={standaloneSkin.sidebarEmptyBody}>
                  AI ile yazışmaya başla; sohbetlerin burada birikecek.
                </p>
                <button type="button" onClick={handleNewChatClick} className={standaloneSkin.sidebarEmptyCta}>
                  İlk sohbetini başlat
                </button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <p className={standaloneSkin.sidebarArchiveEmpty}>Sonuç bulunamadı.</p>
            ) : (
              <div className={standaloneSkin.sidebarArchiveList} aria-label="Sohbet sekmeleri">
                {filteredGroups.map((group) => (
                  <div key={group.label} className="min-w-0">
                    <p className={standaloneSkin.sidebarGroupLabel}>{group.label}</p>
                    <ul className="flex min-w-0 flex-col gap-0.5">
                      {group.items.map((item) => {
                        const href = `/standalone?chat=${item.id}`;
                        const active = pathname === '/standalone' && activeChatId === item.id;
                        const isEditing = editingId === item.id;
                        return (
                          <li key={item.id} className="group min-w-0">
                            <div
                              className={cn(
                                standaloneSkin.sidebarArchiveRow,
                                active ? 'bg-white/80' : ''
                              )}
                            >
                              {isEditing ? (
                                <input
                                  ref={renameInputRef}
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename();
                                    else if (e.key === 'Escape') cancelRename();
                                  }}
                                  className={standaloneSkin.sidebarRenameInput}
                                  aria-label="Sohbet başlığını düzenle"
                                />
                              ) : (
                                <>
                                  <Link
                                    href={href}
                                    onClick={onMobileClose}
                                    title={item.title}
                                    className={standaloneSkin.sidebarArchiveItem}
                                  >
                                    <span className={standaloneSkin.sidebarArchiveTitle}>
                                      {summarizeArchiveTitle(item.title)}
                                    </span>
                                    <span className={standaloneSkin.sidebarArchiveMeta}>
                                      {new Date(item.savedAt).toLocaleDateString('tr-TR', {
                                        day: 'numeric',
                                        month: 'short',
                                      })}
                                      {' · '}
                                      {item.messageCount} mesaj
                                    </span>
                                  </Link>
                                  <button
                                    type="button"
                                    className={
                                      item.pinned
                                        ? standaloneSkin.sidebarArchiveActionActive
                                        : standaloneSkin.sidebarArchiveActionBtn
                                    }
                                    aria-label={item.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                                    title={item.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                                    onClick={(e) => handlePinToggle(e, item)}
                                  >
                                    <Pin className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className={standaloneSkin.sidebarArchiveActionBtn}
                                    aria-label={`${summarizeArchiveTitle(item.title)} yeniden adlandır`}
                                    title="Yeniden adlandır"
                                    onClick={(e) => startRename(e, item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className={standaloneSkin.sidebarArchiveDeleteBtn}
                                    aria-label={`${summarizeArchiveTitle(item.title)} sil`}
                                    title="Sil"
                                    onClick={(e) => handleDeleteChat(e, item)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </nav>

          <div className={standaloneSkin.sidebarFooter}>
            <div className={standaloneSkin.sidebarAccountRow} aria-disabled="true">
              <User className="h-4 w-4 shrink-0 opacity-60" />
              Hesap
              <span className={standaloneSkin.sidebarAccountBadge}>yakında</span>
            </div>
            <div className={standaloneSkin.sidebarToggleRow}>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 shrink-0 opacity-60" />
                SAFE-only
              </span>
              <button
                type="button"
                onClick={() => onSafeOnlyModeChange(!safeOnlyMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  safeOnlyMode ? 'bg-standalone-primary/85' : 'bg-standalone-text-muted/20'
                }`}
                aria-label={safeOnlyMode ? 'SAFE-only kapat' : 'SAFE-only aç'}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    safeOnlyMode ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <details className={standaloneSkin.sidebarHelpDetails}>
              <summary className={standaloneSkin.sidebarHelpSummary}>Bu mod ne işe yarar?</summary>
              <p className={standaloneSkin.sidebarHelpBody}>
                Açıkken model yanıtı EZA tarafından güvenli ve uyumlu olacak şekilde yeniden yazılır;
                ekranda skorlar yerine Safe / Warning / Blocked rozeti görünür. Kapalıyken ham
                etkileşim akar ve EZA skorlarıyla birlikte analiz edilir.
              </p>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
