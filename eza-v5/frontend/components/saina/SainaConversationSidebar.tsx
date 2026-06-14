'use client';

import { MessageSquarePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_BRAND,
  SAINA_CONVERSATIONS_TITLE,
  SAINA_ANON_FREE_BODY,
  SAINA_ANON_FREE_CTA,
  SAINA_ANON_FREE_NOTE,
  SAINA_FREE_TITLE,
  SAINA_LOGGEDIN_FREE_BODY,
  SAINA_LOGGEDIN_FREE_CTA,
  SAINA_LOGGEDIN_FREE_NOTE,
  SAINA_NEW_CHAT,
  SAINA_PLAN_ACTIVE,
  SAINA_PLAN_LOADING_BODY,
  SAINA_PLAN_LOGIN_CTA,
  SAINA_PLAN_SESSION_INVALID_BODY,
  SAINA_PLAN_SESSION_INVALID_NOTE,
  SAINA_POWERED,
  SAINA_PREMIUM_BODY,
  SAINA_PREMIUM_MIRROR_ACTIVE,
  SAINA_PREMIUM_PATTERN_ACTIVE,
  SAINA_PREMIUM_TITLE,
  SAINA_RELATIONSHIP_PATTERN_BODY,
  SAINA_RELATIONSHIP_PATTERN_CTA,
  SAINA_RELATIONSHIP_PATTERN_TITLE,
} from '@/lib/eza/sainaCopy';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import SainaGeometricMark from './SainaGeometricMark';

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
  activeChatId?: string | null;
  /** Highlights İlişki Deseni nav when on pattern route. */
  activeSection?: 'chat' | 'pattern';
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
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
  /** Shown when premium user has chats but no local behavioral history. */
  patternDeviceNotice?: string | null;
};

export default function SainaConversationSidebar({
  conversations,
  activeChatId = null,
  activeSection = 'chat',
  onNewChat,
  onSelectChat,
  onOpenPattern,
  planTier = 'premium',
  onUpgrade,
  onRequestLogin,
  mobileOpen = false,
  onMobileClose,
  showMobileChrome = true,
  className,
  interactionsDisabled = false,
  patternDeviceNotice = null,
}: SainaConversationSidebarProps) {
  const items = conversations ?? MOCK_SAINA_CONVERSATIONS;
  const isMock = conversations == null;
  const disabled = interactionsDisabled || isMock;

  const renderPlanCard = () => {
    if (planTier === 'loading') {
      return (
        <>
          <div className="saina-premium-mini-row">
            <span className="saina-premium-mini-title">{SAINA_BRAND}</span>
          </div>
          <p className="saina-plan-card-body saina-plan-card-body--loading">{SAINA_PLAN_LOADING_BODY}</p>
        </>
      );
    }

    if (planTier === 'session_invalid') {
      return (
        <>
          <div className="saina-premium-mini-row">
            <span className="saina-premium-mini-title">{SAINA_BRAND}</span>
          </div>
          <p className="saina-plan-card-body">{SAINA_PLAN_SESSION_INVALID_BODY}</p>
          <button
            type="button"
            className="saina-plan-card-cta"
            data-testid="saina-plan-login-cta"
            onClick={() => onRequestLogin?.()}
          >
            {SAINA_PLAN_LOGIN_CTA}
          </button>
          <p className="saina-plan-card-note">{SAINA_PLAN_SESSION_INVALID_NOTE}</p>
        </>
      );
    }

    if (planTier === 'anonymous') {
      return (
        <>
          <div className="saina-premium-mini-row">
            <span className="saina-premium-mini-title">{SAINA_FREE_TITLE}</span>
            <span className="saina-premium-mini-badge">{SAINA_PLAN_ACTIVE}</span>
          </div>
          <p className="saina-plan-card-body">{SAINA_ANON_FREE_BODY}</p>
          <button
            type="button"
            className="saina-plan-card-cta"
            data-testid="saina-plan-upgrade-cta"
            onClick={() => onUpgrade?.()}
          >
            {SAINA_ANON_FREE_CTA}
          </button>
          <p className="saina-plan-card-note">{SAINA_ANON_FREE_NOTE}</p>
        </>
      );
    }

    const isPremium = planTier === 'premium';

    return (
      <>
        <div className="saina-premium-mini-row">
          <span className="saina-premium-mini-title">
            {isPremium ? SAINA_PREMIUM_TITLE : SAINA_FREE_TITLE}
          </span>
          <span className="saina-premium-mini-badge">{SAINA_PLAN_ACTIVE}</span>
        </div>
        <p className="saina-plan-card-body">
          {isPremium ? SAINA_PREMIUM_BODY : SAINA_LOGGEDIN_FREE_BODY}
        </p>
        {isPremium ? (
          <>
            <p className="saina-plan-card-status">{SAINA_PREMIUM_MIRROR_ACTIVE}</p>
            <p className="saina-plan-card-status">{SAINA_PREMIUM_PATTERN_ACTIVE}</p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="saina-plan-card-cta"
              data-testid="saina-plan-upgrade-cta"
              onClick={() => onUpgrade?.()}
            >
              {SAINA_LOGGEDIN_FREE_CTA}
            </button>
            <p className="saina-plan-card-note">{SAINA_LOGGEDIN_FREE_NOTE}</p>
          </>
        )}
      </>
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

            <p className="saina-section-label">{SAINA_CONVERSATIONS_TITLE}</p>

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

          <div className="saina-conv-list">
            {items.map((item) => {
              const active = activeChatId != null && item.id === activeChatId;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled && !onSelectChat}
                  className={cn('saina-conv-row', active && 'saina-conv-row--active')}
                  onClick={() => {
                    onSelectChat?.(item.id);
                    onMobileClose?.();
                  }}
                >
                  <div
                    className="saina-conv-thumb"
                    style={{ background: item.thumbGradient }}
                  />
                  <div className="saina-conv-body">
                    <p className="saina-conv-title">{item.title}</p>
                    <p className="saina-conv-preview">{item.preview}</p>
                    <p className="saina-conv-meta">{item.time}</p>
                  </div>
                  {active ? <span className="saina-conv-active-dot" aria-hidden /> : null}
                </button>
              );
            })}
          </div>

          {patternDeviceNotice ? (
            <p
              className="saina-pattern-device-notice"
              data-testid="saina-pattern-device-notice"
              role="status"
            >
              {patternDeviceNotice}
            </p>
          ) : null}

          <div className="saina-sidebar-bottom">
            <div
              className="saina-premium-card saina-premium-card--mini saina-premium-card--dark saina-plan-card"
              data-testid="saina-plan-card"
              data-plan-tier={planTier}
            >
              {renderPlanCard()}
            </div>

            <button
              type="button"
              className={cn(
                'saina-pattern-nav saina-pattern-nav--dark',
                activeSection === 'pattern' && 'saina-pattern-nav--active'
              )}
              onClick={handlePatternOpen}
              aria-current={activeSection === 'pattern' ? 'page' : undefined}
            >
              <div className="saina-pattern-nav-main">
                <SainaGeometricMark size={18} variant="gold" />
                <div className="saina-pattern-nav-text">
                  <span className="saina-pattern-nav-title">{SAINA_RELATIONSHIP_PATTERN_TITLE}</span>
                  <span className="saina-pattern-nav-body">{SAINA_RELATIONSHIP_PATTERN_BODY}</span>
                </div>
              </div>
              <span className="saina-pattern-nav-cta">
                {activeSection === 'pattern' ? 'Açık' : SAINA_RELATIONSHIP_PATTERN_CTA}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
