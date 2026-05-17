'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, MessageSquarePlus, Shield, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  CHATS_UPDATED_EVENT,
  createStandaloneChat,
  deleteChatArchive,
  listChatArchives,
  summarizeArchiveTitle,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';

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

  const refreshChats = useCallback(() => {
    setChats(listChatArchives());
  }, []);

  useEffect(() => {
    refreshChats();
    window.addEventListener(CHATS_UPDATED_EVENT, refreshChats);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, refreshChats);
  }, [refreshChats]);

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
        const newId = createStandaloneChat();
        router.push(`/standalone?chat=${newId}`);
      }
    }
    refreshChats();
  };

  const handleNewChatClick = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      const newId = createStandaloneChat();
      router.push(`/standalone?chat=${newId}`);
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
              href="/standalone/reports"
              onClick={onMobileClose}
              className={cn(
                standaloneSkin.sidebarNavItem,
                navActive('/standalone/reports') || navActive('/standalone/insights')
                  ? 'bg-white/80 text-standalone-text'
                  : ''
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0 opacity-60" />
              EZA&apos;nın Son Gözlemi
            </Link>

            <p className={standaloneSkin.sidebarSectionLabel}>Sohbetler</p>
            {chats.length === 0 ? (
              <p className={standaloneSkin.sidebarArchiveEmpty}>
                Yeni sohbet başlattığınızda burada görünür.
              </p>
            ) : (
              <ul className={standaloneSkin.sidebarArchiveList} aria-label="Sohbet sekmeleri">
                {chats.map((item) => {
                  const href = `/standalone?chat=${item.id}`;
                  const active =
                    pathname === '/standalone' && activeChatId === item.id;
                  return (
                    <li key={item.id} className="group min-w-0">
                      <div
                        className={cn(
                          standaloneSkin.sidebarArchiveRow,
                          active ? 'bg-white/80' : ''
                        )}
                      >
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
                          className={standaloneSkin.sidebarArchiveDeleteBtn}
                          aria-label={`${summarizeArchiveTitle(item.title)} sil`}
                          onClick={(e) => handleDeleteChat(e, item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          <div className={standaloneSkin.sidebarFooter}>
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
