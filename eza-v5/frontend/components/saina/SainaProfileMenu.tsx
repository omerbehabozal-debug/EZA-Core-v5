'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { isSainaPaidTier } from '@/lib/eza/plan/sainaAccountTiers';
import {
  buildSainaAuthHref,
  resolveSainaPlanLabel,
  resolveSainaUserDisplayName,
  resolveSainaUserInitial,
} from '@/lib/eza/sainaIdentity';
import { useSainaAuthReturnUrl } from '@/hooks/useSainaAuthReturnUrl';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_EZA_PREF_OFF,
  SAINA_EZA_PREF_ON,
  SAINA_EZA_PROCESSING_LABEL,
  SAINA_EZA_PROCESSING_NOTE,
  SAINA_EZA_VISIBILITY_LABEL,
  SAINA_EZA_VISIBILITY_NOTE,
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
  SAINA_SAFE_MODE_OFF,
  SAINA_SAFE_MODE_ON,
} from '@/lib/eza/sainaCopy';
import {
  getEzaUserPreferences,
  setEzaUserPreferences,
  subscribeEzaUserPreferences,
  type EzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
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

export default function SainaProfileMenu({
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  disabled = false,
}: SainaProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [ezaPrefs, setEzaPrefs] = useState<EzaUserPreferences>(() =>
    getEzaUserPreferences(null)
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const returnUrl = useSainaAuthReturnUrl();
  const { isAuthenticated, user, logout, isAuthReady, setAuth, token } = useAuth();
  const ownerUserId = user?.user_id?.trim() || null;
  const { isPlus, isLoading, source } = usePlan();
  const { entitlements: accountEntitlements } = useAccountEntitlements();
  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isLoading || !isAuthReady,
    source,
    accountTier: accountEntitlements.tier,
  });
  const isGuest = !isAuthenticated;
  const displayName = resolveSainaUserDisplayName(
    user?.email,
    user?.full_name,
    user?.public_display_name
  );
  const userInitial = resolveSainaUserInitial(
    user?.email,
    user?.public_display_name,
    user?.full_name
  );
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaveState, setNameSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [nameError, setNameError] = useState<string | null>(null);
  const planLabel = resolveSainaPlanLabel(planTier);
  const currentModel = getAnalysisModelById(analysisModelId);
  const loginHref = buildSainaAuthHref(returnUrl, 'login');
  const registerHref = buildSainaAuthHref(returnUrl, 'register');

  useEffect(() => {
    if (!open || isGuest) return;
    setNameDraft((user?.public_display_name || user?.full_name || '').trim());
    setNameSaveState('idle');
    setNameError(null);
  }, [open, isGuest, user?.public_display_name, user?.full_name]);

  useEffect(() => {
    setEzaPrefs(getEzaUserPreferences(ownerUserId));
    return subscribeEzaUserPreferences(() => {
      setEzaPrefs(getEzaUserPreferences(ownerUserId));
    });
  }, [ownerUserId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!modelOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [modelOpen]);

  const close = () => {
    setOpen(false);
    setModelOpen(false);
  };

  const patchEzaPref = (patch: Partial<EzaUserPreferences>) => {
    setEzaPrefs(setEzaUserPreferences(ownerUserId, patch));
  };

  const savePublicDisplayName = async () => {
    if (!token || !user) return;
    setNameSaveState('saving');
    setNameError(null);
    const { patchPublicIdentity } = await import('@/lib/eza/plan/fetchAuthMe');
    const result = await patchPublicIdentity(nameDraft);
    if (!result.ok) {
      setNameSaveState('error');
      setNameError(
        result.code === 'display_name_looks_like_email'
          ? 'E-posta adresi kullanılamaz.'
          : result.code === 'display_name_too_short'
            ? 'En az 2 karakter girin.'
            : result.code === 'display_name_too_long'
              ? 'En fazla 48 karakter.'
              : result.code === 'display_name_reserved'
                ? 'Bu ad kullanılamaz.'
                : 'Kaydedilemedi. Tekrar deneyin.'
      );
      return;
    }
    setAuth(token, {
      ...user,
      public_display_name: result.public_display_name,
      full_name: result.public_display_name,
    });
    setNameDraft(result.public_display_name);
    setNameSaveState('saved');
  };

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
                {user?.email ? (
                  <p className="saina-profile-menu-row-note" data-testid="saina-account-email">
                    {user.email}
                  </p>
                ) : null}
                {planLabel ? (
                  <p
                    className={cn(
                      'saina-profile-menu-plan-label',
                      isSainaPaidTier(planTier) && 'saina-profile-menu-plan-label--premium'
                    )}
                  >
                    {planLabel}
                  </p>
                ) : null}
                <div
                  className="saina-profile-menu-row saina-profile-menu-row--stack"
                  data-testid="saina-public-name-editor"
                >
                  <span className="saina-profile-menu-row-title">
                    Herkese açık ad
                  </span>
                  <input
                    type="text"
                    className="saina-profile-menu-input"
                    value={nameDraft}
                    maxLength={48}
                    disabled={disabled || nameSaveState === 'saving'}
                    onChange={(e) => {
                      setNameDraft(e.target.value);
                      setNameSaveState('idle');
                      setNameError(null);
                    }}
                    placeholder="biligN kullanıcısı"
                    aria-label="Herkese açık görünen ad"
                    data-testid="saina-public-name-input"
                  />
                  <span className="saina-profile-menu-row-note">
                    Başkaları profilinizde bu adı görür. E-posta asla isim olarak yayınlanmaz.
                  </span>
                  <button
                    type="button"
                    className="saina-profile-menu-auth-btn saina-profile-menu-auth-btn--primary"
                    disabled={disabled || nameSaveState === 'saving'}
                    onClick={() => void savePublicDisplayName()}
                    data-testid="saina-public-name-save"
                  >
                    {nameSaveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  {nameSaveState === 'saved' ? (
                    <span className="saina-profile-menu-row-note" role="status">
                      Kaydedildi.
                    </span>
                  ) : null}
                  {nameError ? (
                    <span className="saina-profile-menu-row-note" role="alert">
                      {nameError}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className="saina-profile-menu-section">
            <p className="saina-profile-menu-section-label">
              <Settings size={14} aria-hidden />
              {SAINA_MENU_SETTINGS}
            </p>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack">
              <span className="saina-profile-menu-row-title">{SAINA_SAFE_MODE_LABEL}</span>
              <div
                className="saina-safe-mode-segmented"
                role="group"
                aria-label={SAINA_SAFE_MODE_LABEL}
              >
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    !safeOnlyMode && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={!safeOnlyMode}
                  onClick={() => onSafeOnlyModeChange(false)}
                  data-testid="saina-safe-mode-off"
                >
                  {SAINA_SAFE_MODE_OFF}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    safeOnlyMode && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={safeOnlyMode}
                  onClick={() => onSafeOnlyModeChange(true)}
                  data-testid="saina-safe-mode-on"
                >
                  {SAINA_SAFE_MODE_ON}
                </button>
              </div>
              <span className="saina-profile-menu-row-note">{SAINA_SAFE_MODE_NOTE}</span>
            </div>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack">
              <span className="saina-profile-menu-row-title">{SAINA_EZA_VISIBILITY_LABEL}</span>
              <div
                className="saina-safe-mode-segmented"
                role="group"
                aria-label={SAINA_EZA_VISIBILITY_LABEL}
              >
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    ezaPrefs.ezaVisibilityEnabled && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={ezaPrefs.ezaVisibilityEnabled}
                  onClick={() => patchEzaPref({ ezaVisibilityEnabled: true })}
                  data-testid="saina-eza-visibility-on"
                >
                  {SAINA_EZA_PREF_ON}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    !ezaPrefs.ezaVisibilityEnabled && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={!ezaPrefs.ezaVisibilityEnabled}
                  onClick={() => patchEzaPref({ ezaVisibilityEnabled: false })}
                  data-testid="saina-eza-visibility-off"
                >
                  {SAINA_EZA_PREF_OFF}
                </button>
              </div>
              <span className="saina-profile-menu-row-note">{SAINA_EZA_VISIBILITY_NOTE}</span>
            </div>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack">
              <span className="saina-profile-menu-row-title">{SAINA_EZA_PROCESSING_LABEL}</span>
              <div
                className="saina-safe-mode-segmented"
                role="group"
                aria-label={SAINA_EZA_PROCESSING_LABEL}
              >
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    ezaPrefs.ezaDataProcessingEnabled && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={ezaPrefs.ezaDataProcessingEnabled}
                  onClick={() => patchEzaPref({ ezaDataProcessingEnabled: true })}
                  data-testid="saina-eza-processing-on"
                >
                  {SAINA_EZA_PREF_ON}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'saina-safe-mode-segment',
                    !ezaPrefs.ezaDataProcessingEnabled && 'saina-safe-mode-segment--active'
                  )}
                  aria-pressed={!ezaPrefs.ezaDataProcessingEnabled}
                  onClick={() => patchEzaPref({ ezaDataProcessingEnabled: false })}
                  data-testid="saina-eza-processing-off"
                >
                  {SAINA_EZA_PREF_OFF}
                </button>
              </div>
              <span className="saina-profile-menu-row-note">{SAINA_EZA_PROCESSING_NOTE}</span>
            </div>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack" ref={modelRef}>
              <span className="saina-profile-menu-row-title">{SAINA_ANALYSIS_MODEL_LABEL}</span>
              <button
                type="button"
                disabled={disabled}
                className="saina-profile-model-trigger"
                aria-haspopup="listbox"
                aria-expanded={modelOpen}
                data-testid="saina-profile-model-trigger"
                onClick={() => setModelOpen((value) => !value)}
              >
                <span>{currentModel.label}</span>
                <ChevronDown size={14} aria-hidden className={cn(modelOpen && 'rotate-180')} />
              </button>
              {modelOpen ? (
                <div
                  className="saina-profile-model-dropdown"
                  role="listbox"
                  aria-label={SAINA_ANALYSIS_MODEL_LABEL}
                  data-testid="saina-profile-model-dropdown"
                >
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
                        data-testid={`saina-profile-model-${model.id}`}
                        onClick={() => {
                          onAnalysisModelChange(model.id);
                          setModelOpen(false);
                        }}
                      >
                        {model.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
