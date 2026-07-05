'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import {
  resolveSainaPlanLabel,
  resolveSainaUserDisplayName,
  resolveSainaUserInitial,
} from '@/lib/eza/sainaIdentity';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_MENU_ACCOUNT,
  SAINA_MENU_GUEST_LABEL,
  SAINA_MENU_GUEST_MULTI_DEVICE,
  SAINA_MENU_GUEST_SAVE_CHATS,
  SAINA_MENU_GUEST_SYNC_MIRRORS,
  SAINA_MENU_LOGIN,
  SAINA_MENU_LOGOUT,
  SAINA_MENU_REGISTER,
  SAINA_MENU_SETTINGS,
  SAINA_SAFE_MODE_LABEL,
  SAINA_SAFE_MODE_NOTE,
} from '@/lib/eza/sainaCopy';
import {
  STANDALONE_ANALYSIS_MODELS,
  getAnalysisModelById,
} from '@/lib/standaloneModels';

export type SainaProfileMenuProps = {
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  disabled?: boolean;
};

function buildAuthHref(pathname: string, page: 'login' | 'register') {
  const returnTo = encodeURIComponent(pathname || '/standalone');
  return `/platform/${page}?return=${returnTo}`;
}

export default function SainaProfileMenu({
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  disabled = false,
}: SainaProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { isAuthenticated, user, logout, isAuthReady } = useAuth();
  const { isPlus, isLoading, source } = usePlan();
  const planTier = resolveSainaPlanTier({ isPlus, isLoading: isLoading || !isAuthReady, source });
  const isGuest = !isAuthenticated;
  const displayName = resolveSainaUserDisplayName(user?.email);
  const userInitial = resolveSainaUserInitial(user?.email);
  const planLabel = resolveSainaPlanLabel(planTier);
  const currentModel = getAnalysisModelById(analysisModelId);
  const loginHref = buildAuthHref(pathname || '/standalone', 'login');
  const registerHref = buildAuthHref(pathname || '/standalone', 'register');

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="saina-profile-menu-root">
      <button
        type="button"
        className="saina-top-avatar-wrap saina-profile-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Profil ve ayarlar"
        data-testid="saina-profile-menu-trigger"
      >
        {isGuest ? (
          <div
            className="saina-profile-avatar saina-profile-avatar--top saina-profile-avatar--guest"
            aria-hidden
          >
            <User size={16} />
          </div>
        ) : (
          <div className="saina-profile-avatar saina-profile-avatar--top">{userInitial}</div>
        )}
        <span className="saina-status-dot" aria-hidden />
      </button>

      {open ? (
        <div className="saina-profile-menu" data-testid="saina-profile-menu">
          <div className="saina-profile-menu-account-block">
            <p className="saina-profile-menu-section-label saina-profile-menu-section-label--plain">
              {SAINA_MENU_ACCOUNT}
            </p>
            {isGuest ? (
              <>
                <p className="saina-profile-menu-account-name">{SAINA_MENU_GUEST_LABEL}</p>
                <ul className="saina-profile-menu-benefits">
                  <li>{SAINA_MENU_GUEST_SAVE_CHATS}</li>
                  <li>{SAINA_MENU_GUEST_SYNC_MIRRORS}</li>
                  <li>{SAINA_MENU_GUEST_MULTI_DEVICE}</li>
                </ul>
                <div className="saina-profile-menu-auth-actions">
                  <Link
                    href={loginHref}
                    className="saina-profile-menu-auth-btn saina-profile-menu-auth-btn--primary"
                    data-testid="saina-profile-login"
                    onClick={close}
                  >
                    {SAINA_MENU_LOGIN}
                  </Link>
                  <Link
                    href={registerHref}
                    className="saina-profile-menu-auth-btn"
                    data-testid="saina-profile-register"
                    onClick={close}
                  >
                    {SAINA_MENU_REGISTER}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="saina-profile-menu-account-name">{displayName}</p>
                {planLabel ? (
                  <p
                    className={cn(
                      'saina-profile-menu-plan-label',
                      planTier === 'premium' && 'saina-profile-menu-plan-label--premium'
                    )}
                  >
                    {planLabel}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="saina-profile-menu-section">
            <p className="saina-profile-menu-section-label">
              <Settings size={14} aria-hidden />
              {SAINA_MENU_SETTINGS}
            </p>

            <div className="saina-profile-menu-row">
              <div className="saina-profile-menu-row-text">
                <span className="saina-profile-menu-row-title">{SAINA_SAFE_MODE_LABEL}</span>
                <span className="saina-profile-menu-row-note">{SAINA_SAFE_MODE_NOTE}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={safeOnlyMode}
                aria-label={safeOnlyMode ? 'Güvenli Mod açık' : 'Güvenli Mod kapalı'}
                disabled={disabled}
                className={cn('saina-profile-toggle', safeOnlyMode && 'saina-profile-toggle--on')}
                onClick={() => onSafeOnlyModeChange(!safeOnlyMode)}
                data-testid="saina-safe-mode-toggle"
              >
                <span className="saina-profile-toggle-knob" />
              </button>
            </div>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack">
              <span className="saina-profile-menu-row-title">{SAINA_ANALYSIS_MODEL_LABEL}</span>
              <div className="saina-profile-model-list" role="listbox" aria-label={SAINA_ANALYSIS_MODEL_LABEL}>
                {STANDALONE_ANALYSIS_MODELS.map((model) => {
                  const active = model.id === analysisModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={cn(
                        'saina-profile-model-option',
                        active && 'saina-profile-model-option--active'
                      )}
                      onClick={() => onAnalysisModelChange(model.id)}
                    >
                      <span>{model.label}</span>
                      {active ? <ChevronRight size={14} className="opacity-50" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              <span className="saina-profile-menu-row-note">Seçili: {currentModel.label}</span>
            </div>
          </div>

          {!isGuest ? (
            <button
              type="button"
              className="saina-profile-menu-item"
              data-testid="saina-profile-logout"
              onClick={() => {
                close();
                logout();
              }}
            >
              <LogOut size={15} aria-hidden />
              <span>{SAINA_MENU_LOGOUT}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
