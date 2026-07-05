'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, GitBranch, MessageSquarePlus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_BRAND,
  SAINA_NEW_CHAT,
  SAINA_SIDEBAR_FREE_FOOTER,
  SAINA_PLAN_LOADING_BODY,
  SAINA_PLAN_LOGIN_CTA,
  SAINA_PLAN_SESSION_INVALID_BODY,
  SAINA_POWERED,
  SAINA_PREMIUM_TITLE,
  SAINA_RELATIONSHIP_PATTERN_TITLE,
} from '@/lib/eza/sainaCopy';
import { SAINA_DISCOVER_TITLE } from '@/lib/eza/mirror-network/discoverCopy';
import { SAINA_DISCOVER_ROUTE } from '@/lib/eza/sainaRoutes';
import type { SainaAppView } from '@/lib/eza/sainaRoutes';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';
import { groupConversationsByTimeBucket } from '@/lib/eza/sainaConversationList';
import type { ConversationTreeGroupNode } from '@/lib/eza/conversation-tree/types';
import {
  readGroupExpanded,
  writeGroupExpanded,
} from '@/lib/eza/conversation-tree/groupExpandedState';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import SainaGeometricMark from './SainaGeometricMark';

function SainaConversationThumb({
  thumbGradient,
  thumbImageUrl,
}: {
  thumbGradient: string;
  thumbImageUrl?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbImageUrl]);

  const showImage = Boolean(thumbImageUrl) && !imageFailed;

  return (
    <div className="saina-conv-thumb" style={{ background: thumbGradient }}>
      {showImage ? (
        <img
          src={thumbImageUrl!}
          alt=""
          className="saina-conv-thumb__image"
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </div>
  );
}

export type { SainaConversationItem, SainaPlanTier };

export const MOCK_SAINA_CONVERSATIONS: SainaConversationItem[] = [
  {
    id: 'new-chat',
    title: 'Yeni Sohbet',
    preview: 'SAINA ile düşün, keşfet…',
    time: 'Az önce',
    thumbGradient: 'linear-gradient(135deg, #173B45, #0F2B25, #041B17)',
  },
  {
    id: 'uzbekistan',
    title: 'Özbekistan Sohbeti',
    preview: 'İpek Yolu ve Semerkant üzerine…',
    time: '10:42',
    thumbGradient: 'linear-gradient(135deg, #c47a3a, #8b5a2b, #3d2914)',
  },
  {
    id: 'bmw',
    title: 'BMW iX Sohbeti',
    preview: 'Elektrikli SUV karşılaştırması…',
    time: 'Dün',
    thumbGradient: 'linear-gradient(135deg, #4a5568, #2d3748, #1a202c)',
  },
  {
    id: 'eza-mvp',
    title: 'EZA MVP Sohbeti',
    preview: 'Ürün yol haritası ve öncelikler…',
    time: 'Dün',
    thumbGradient: 'linear-gradient(135deg, #6B8A7A, #0F3D32, #1a3d34)',
  },
  {
    id: 'mardin',
    title: 'Mardin Sohbeti',
    preview: 'Taş şehir ve mimari miras…',
    time: '2 gün önce',
    thumbGradient: 'linear-gradient(135deg, #a89078, #6b5d4f, #3d342c)',
  },
  {
    id: 'kids',
    title: 'Çocuklar Sohbeti',
    preview: 'Ebeveynlik ve dijital denge…',
    time: '3 gün önce',
    thumbGradient: 'linear-gradient(135deg, #d4a574, #b8895a, #8b6342)',
  },
  {
    id: 'strategy',
    title: 'Strateji Sohbeti',
    preview: 'Uzun vadeli planlama…',
    time: '1 hafta önce',
    thumbGradient: 'linear-gradient(135deg, #7a8b9a, #4a5568, #2d3748)',
  },
  {
    id: 'philosophy',
    title: 'Felsefe Sohbeti',
    preview: 'Anlam, bilinç ve merak…',
    time: '1 hafta önce',
    thumbGradient: 'linear-gradient(135deg, #5c6b5a, #3d4a3f, #2a332c)',
  },
  {
    id: 'routes',
    title: 'Yolculuk Rotaları',
    preview: 'Rota planlama ve keşif…',
    time: '2 hafta önce',
    thumbGradient: 'linear-gradient(135deg, #4a7c8c, #2d5a6b, #1a3d4a)',
  },
];

type SainaConversationSidebarProps = {
  conversations?: SainaConversationItem[];
  conversationGroups?: ConversationTreeGroupNode[];
  activeChatId?: string | null;
  /** Highlights section nav when on discover / pattern routes. */
  activeSection?: SainaAppView;
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onOpenPattern?: () => void;
  planTier?: SainaPlanTier;
  onUpgrade?: () => void;
  onRequestLogin?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** When false (desktop layout), hide drawer backdrop and close control. */
  showMobileChrome?: boolean;
  className?: string;
  /** Mock route: disable interactions */
  interactionsDisabled?: boolean;
};

export default function SainaConversationSidebar({
  conversations,
  conversationGroups,
  activeChatId = null,
  activeSection = 'chat',
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenPattern,
  planTier = 'premium',
  onUpgrade,
  onRequestLogin,
  mobileOpen = false,
  onMobileClose,
  showMobileChrome = true,
  className,
  interactionsDisabled = false,
}: SainaConversationSidebarProps) {
  const router = useRouter();
  const items = conversations ?? MOCK_SAINA_CONVERSATIONS;
  const isMock = conversations == null && conversationGroups == null;
  const disabled = interactionsDisabled || isMock;
  const useTree = Boolean(conversationGroups && conversationGroups.length > 0);
  const timeGroups = useMemo(
    () => (useTree ? null : groupConversationsByTimeBucket(items)),
    [useTree, items]
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const isGroupExpanded = useCallback(
    (groupId: string) => {
      if (groupId in expandedGroups) return expandedGroups[groupId]!;
      return readGroupExpanded(groupId);
    },
    [expandedGroups]
  );

  const toggleGroup = useCallback((groupId: string) => {
    const next = !isGroupExpanded(groupId);
    writeGroupExpanded(groupId, next);
    setExpandedGroups((prev) => ({ ...prev, [groupId]: next }));
  }, [isGroupExpanded]);

  const renderConversationThumb = (item: {
    thumbGradient: string;
    thumbImageUrl?: string | null;
  }) => (
    <SainaConversationThumb
      thumbGradient={item.thumbGradient}
      thumbImageUrl={item.thumbImageUrl}
    />
  );

  const renderConversationRow = (
    item: {
      id: string;
      title: string;
      preview: string;
      time: string;
      thumbGradient: string;
      thumbImageUrl?: string | null;
      isMirrorSource?: boolean;
    },
    nested = false
  ) => {
    const active = activeChatId != null && item.id === activeChatId;
    const canDelete = Boolean(onDeleteChat) && !disabled;
    return (
      <div
        key={item.id}
        className={cn('saina-conv-row-wrap', nested && 'saina-conv-row-wrap--nested')}
      >
        <button
          type="button"
          disabled={disabled && !onSelectChat}
          className={cn(
            'saina-conv-row',
            active ? 'saina-conv-row--active' : 'saina-conv-row--quiet',
            nested && 'saina-conv-row--nested'
          )}
          data-testid={`saina-conv-row-${item.id}`}
          onClick={() => {
            onSelectChat?.(item.id);
            onMobileClose?.();
          }}
        >
          {renderConversationThumb(item)}
          <div className="saina-conv-body saina-conv-body--compact">
            <div className="saina-conv-title-row">
              <p className="saina-conv-title">
                {item.isMirrorSource ? (
                  <span className="saina-conv-mirror-mark" aria-hidden>
                    ✦{' '}
                  </span>
                ) : null}
                {item.title}
              </p>
              <span className="saina-conv-time">{item.time}</span>
            </div>
          </div>
        </button>
        {canDelete ? (
          <button
            type="button"
            className="saina-conv-delete-btn"
            data-testid={`saina-conv-delete-${item.id}`}
            aria-label={`${item.title} sil`}
            title="Sil"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteChat?.(item.id);
            }}
          >
            <Trash2 size={14} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  const renderPlanFooter = () => {
    if (planTier === 'loading') {
      return (
        <p className="saina-sidebar-plan-footer-text">{SAINA_PLAN_LOADING_BODY}</p>
      );
    }

    if (planTier === 'session_invalid') {
      return (
        <>
          <span className="saina-sidebar-plan-footer-text">{SAINA_PLAN_SESSION_INVALID_BODY}</span>
          <button
            type="button"
            className="saina-sidebar-plan-footer-cta"
            data-testid="saina-plan-login-cta"
            onClick={() => onRequestLogin?.()}
          >
            {SAINA_PLAN_LOGIN_CTA}
          </button>
        </>
      );
    }

    if (planTier === 'premium') {
      return (
        <span className="saina-sidebar-plan-footer-text saina-sidebar-plan-footer-text--premium">
          {SAINA_PREMIUM_TITLE}
        </span>
      );
    }

    return (
      <button
        type="button"
        className="saina-sidebar-plan-footer-cta saina-sidebar-plan-footer-cta--full"
        data-testid="saina-plan-upgrade-cta"
        onClick={() => onUpgrade?.()}
      >
        {SAINA_SIDEBAR_FREE_FOOTER}
      </button>
    );
  };

  const handlePatternOpen = () => {
    if (onOpenPattern) {
      onOpenPattern();
      onMobileClose?.();
      return;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[SAINA mock] İlişki Deseni — Sprint A placeholder');
    }
  };

  return (
    <>
      {showMobileChrome && mobileOpen ? (
        <button
          type="button"
          className="saina-sidebar-backdrop"
          aria-label="Menüyü kapat"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          'saina-sidebar',
          mobileOpen && 'saina-sidebar--mobile-open',
          className
        )}
        aria-label="Sohbetler"
        data-testid="saina-conversation-sidebar"
      >
        <div className="saina-sidebar-inner">
          <div className="saina-sidebar-top">
            <div className="saina-brand-row">
              <div className="saina-brand-mark">
                <SainaGeometricMark size={28} variant="gold" />
              </div>
              <div className="saina-brand-text">
                <p className="saina-brand-title saina-serif">{SAINA_BRAND}</p>
                <p className="saina-brand-powered">{SAINA_POWERED}</p>
              </div>
              {showMobileChrome && mobileOpen ? (
                <button
                  type="button"
                  className="saina-sidebar-close-btn"
                  data-testid="saina-sidebar-close-btn"
                  onClick={onMobileClose}
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="saina-new-chat-btn"
              disabled={disabled && !onNewChat}
              onClick={() => {
                onNewChat?.();
                onMobileClose?.();
              }}
            >
              <MessageSquarePlus size={16} className="saina-new-chat-icon" />
              {SAINA_NEW_CHAT}
            </button>
          </div>

          <div className="saina-conv-list" data-testid="saina-conv-list">
            {useTree && conversationGroups
              ? conversationGroups.map((group) => {
                  const expanded = isGroupExpanded(group.id);
                  return (
                    <div key={group.id} className="saina-conv-group" data-testid={`saina-conv-group-${group.id}`}>
                      <button
                        type="button"
                        className="saina-conv-group-header saina-conv-group-header--quiet"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={expanded}
                      >
                        <span className="saina-conv-group-chevron" aria-hidden>
                          {expanded ? '▾' : '▸'}
                        </span>
                        <span className="saina-conv-group-title">{group.title}</span>
                      </button>
                      {expanded ? (
                        <div className="saina-conv-group-children">
                          {group.conversations.map((item) => renderConversationRow(item, true))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : timeGroups
                ? timeGroups.map((group) => (
                    <div key={group.label} className="saina-time-group" data-testid={`saina-time-group-${group.label}`}>
                      <p className="saina-time-group-label">{group.label}</p>
                      {group.items.map((item) => renderConversationRow(item))}
                    </div>
                  ))
                : items.map((item) => renderConversationRow(item))}
          </div>

          <nav className="saina-sidebar-dock" aria-label="SAINA gezinme">
            <button
              type="button"
              className={cn(
                'saina-sidebar-dock-link',
                activeSection === 'discover' && 'saina-sidebar-dock-link--active'
              )}
              onClick={() => {
                router.push(SAINA_DISCOVER_ROUTE);
                onMobileClose?.();
              }}
              aria-current={activeSection === 'discover' ? 'page' : undefined}
              data-testid="saina-discover-nav"
            >
              <Compass size={15} className="saina-sidebar-dock-icon" aria-hidden />
              <span>{SAINA_DISCOVER_TITLE}</span>
            </button>

            <button
              type="button"
              className={cn(
                'saina-sidebar-dock-link',
                activeSection === 'pattern' && 'saina-sidebar-dock-link--active'
              )}
              onClick={handlePatternOpen}
              aria-current={activeSection === 'pattern' ? 'page' : undefined}
              data-testid="saina-pattern-nav"
            >
              <GitBranch size={15} className="saina-sidebar-dock-icon" aria-hidden />
              <span>{SAINA_RELATIONSHIP_PATTERN_TITLE}</span>
            </button>

            <div
              className="saina-sidebar-plan-footer"
              data-testid="saina-plan-card"
              data-plan-tier={planTier}
            >
              {renderPlanFooter()}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
