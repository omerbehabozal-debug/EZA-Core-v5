'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, MessageSquarePlus, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  ACTIVE_SESSION_ARCHIVE_ID,
  ARCHIVE_UPDATED_EVENT,
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
  hasActiveChat = false,
  onNewChat,
}: StandaloneSidebarProps) {
  const pathname = usePathname();
  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);

  const refreshArchives = useCallback(() => {
    setArchives(listChatArchives());
  }, []);

  useEffect(() => {
    refreshArchives();
    window.addEventListener(ARCHIVE_UPDATED_EVENT, refreshArchives);
    return () => window.removeEventListener(ARCHIVE_UPDATED_EVENT, refreshArchives);
  }, [refreshArchives]);

  const navActive = (href: string) =>
    pathname != null && (pathname === href || pathname.startsWith(`${href}/`));

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

          {onNewChat ? (
            <button
              type="button"
              disabled={!hasActiveChat}
              onClick={() => {
                onNewChat();
                onMobileClose();
              }}
              className={standaloneSkin.sidebarNewChatBtn}
            >
              <MessageSquarePlus className="h-4 w-4 shrink-0 opacity-60" />
              Yeni sohbet
            </button>
          ) : null}

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
              Etkileşim Raporu
            </Link>

            <p className={standaloneSkin.sidebarSectionLabel}>Arşiv</p>
            {archives.length === 0 ? (
              <p className={standaloneSkin.sidebarArchiveEmpty}>
                İlk mesajınızdan sonra burada &quot;Güncel&quot; olarak görünür.
              </p>
            ) : (
              <ul className={standaloneSkin.sidebarArchiveList} aria-label="Kayıtlı sohbetler">
                {archives.map((item) => {
                  const isActiveSession = item.id === ACTIVE_SESSION_ARCHIVE_ID;
                  const href = isActiveSession ? '/standalone' : `/standalone/archive/${item.id}`;
                  const active = isActiveSession
                    ? pathname === '/standalone'
                    : pathname === href;
                  return (
                    <li key={item.id} className="min-w-0">
                      <Link
                        href={href}
                        onClick={onMobileClose}
                        title={item.title}
                        className={cn(
                          standaloneSkin.sidebarArchiveItem,
                          active ? 'bg-white/80' : ''
                        )}
                      >
                        <span className={standaloneSkin.sidebarArchiveTitle}>
                          {summarizeArchiveTitle(item.title)}
                        </span>
                        <span className={standaloneSkin.sidebarArchiveMeta}>
                          {isActiveSession ? 'Güncel · ' : ''}
                          {new Date(item.savedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          {' · '}
                          {item.messageCount} mesaj
                        </span>
                      </Link>
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
