'use client';

import '@/styles/saina-profile-panel.css';
import '@/styles/saina-account-navigation.css';
import '@/styles/profile-avatar-crop-viewer.css';
import '@/styles/bilign-avatar-identity-frame.css';
import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, ChevronDown, ChevronRight, CreditCard, LogOut, Settings, User, X } from 'lucide-react';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { SainaNotificationsContent } from './SainaNotificationsDropdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { resolveSainaPlanTier, type SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import {
  buildSainaAuthHref,
  resolveSainaUserDisplayName,
} from '@/lib/eza/sainaIdentity';
import { useSainaAuthReturnUrl } from '@/hooks/useSainaAuthReturnUrl';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import BilignAvatarIdentityFrame from '@/components/mirror/ayna/BilignAvatarIdentityFrame';
import ProfileAvatarCropEditor from '@/components/mirror/ayna/ProfileAvatarCropEditor';
import ProfileAvatarViewer from '@/components/mirror/ayna/ProfileAvatarViewer';
import {
  isAcceptedProfileAvatarFile,
} from '@/lib/eza/profile/normalizeProfileAvatarFile';
import { publicAvatarSaveErrorMessage } from '@/lib/eza/plan/fetchAuthMe';
import { resolveAuthenticatedAvatarDisplay } from '@/lib/eza/profile/authoritativeAvatar';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_EZA_PROCESSING_LABEL,
  SAINA_EZA_PROCESSING_NOTE,
  SAINA_EZA_VISIBILITY_LABEL,
  SAINA_EZA_VISIBILITY_NOTE,
  SAINA_MENU_GUEST_LABEL,
  SAINA_MENU_GUEST_MULTI_DEVICE,
  SAINA_MENU_GUEST_SAVE_CHATS,
  SAINA_MENU_GUEST_SYNC_MIRRORS,
  SAINA_MENU_LOGIN,
  SAINA_MENU_LOGOUT,
  SAINA_MENU_REGISTER,
  SAINA_MENU_SETTINGS,
  SAINA_PROFILE_PLAN_EYEBROW,
  SAINA_SAFE_MODE_LABEL,
  SAINA_SAFE_MODE_NOTE,
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
  onSafeOnlyModeChange?: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange?: (modelId: string) => void;
  disabled?: boolean;
  /** Controlled open — mobile overflow / avatar reuse the same Hesabım panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the top-bar avatar trigger when another affordance owns open/close. */
  hideTrigger?: boolean;
};

function resolveQuietAccountPlanLabel(planTier: SainaPlanTier): string | null {
  if (planTier === 'free') return 'Free';
  if (planTier === 'mini') return 'Mini';
  if (planTier === 'standard') return 'Standard';
  if (planTier === 'premium') return 'Premium';
  return null;
}

function ProfileSettingSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  testId,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn('saina-profile-toggle', checked && 'saina-profile-toggle--on')}
      data-testid={testId}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="saina-profile-toggle-knob" aria-hidden />
      <span className="sr-only">{checked ? 'Açık' : 'Kapalı'}</span>
    </button>
  );
}

function ProfileIdentityMark({
  isGuest,
  displayName,
  userId,
  avatarUrl,
  avatarCacheBust,
  hasPhoto,
  onAvatarView,
  onAvatarAdd,
  avatarBusy,
  avatarTriggerRef,
  interactive = true,
}: {
  isGuest: boolean;
  displayName: string;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarCacheBust?: number | string;
  hasPhoto?: boolean;
  onAvatarView?: () => void;
  onAvatarAdd?: () => void;
  avatarBusy?: boolean;
  avatarTriggerRef?: RefObject<HTMLButtonElement>;
  interactive?: boolean;
}) {
  return (
    <BilignAvatarIdentityFrame variant="profile" className="saina-profile-menu-identity-mark">
      {isGuest ? (
        <div className="saina-profile-menu-identity-face saina-profile-menu-identity-face--guest">
          <User size={22} />
        </div>
      ) : interactive ? (
        <button
          ref={avatarTriggerRef}
          type="button"
          className="saina-profile-menu-identity-face-btn"
          onClick={hasPhoto ? onAvatarView : onAvatarAdd}
          disabled={avatarBusy}
          aria-label={hasPhoto ? 'Profil fotoğrafını görüntüle' : 'Profil fotoğrafı ekle'}
          data-testid="saina-profile-avatar-trigger"
        >
          <ProfileUserAvatar
            displayName={displayName}
            userId={userId}
            avatarUrl={avatarUrl}
            cacheBust={avatarCacheBust}
            size="panel"
            className="saina-profile-menu-identity-face"
          />
        </button>
      ) : (
        <ProfileUserAvatar displayName={displayName} userId={userId} avatarUrl={avatarUrl}
          cacheBust={avatarCacheBust} size="panel" className="saina-profile-menu-identity-face" />
      )}
    </BilignAvatarIdentityFrame>
  );
}

export default function SainaProfileMenu({
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  disabled = false,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: SainaProfileMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [section, setSection] = useState<'menu' | 'notifications' | 'profile' | 'settings' | 'plan'>('menu');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const notifications = useSainaChromeStore((state) => state.notifications);
  const onUpgrade = useSainaChromeStore((state) => state.onUpgrade);
  const settingsSectionRef = useRef<HTMLDivElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [ezaPrefs, setEzaPrefs] = useState<EzaUserPreferences>(() =>
    getEzaUserPreferences(null)
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const returnUrl = useSainaAuthReturnUrl();
  const { isAuthenticated, user, logout, isAuthReady, setAuth, patchAuthUser, token } = useAuth();
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
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaveState, setNameSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarSaveState, setAvatarSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<
    | { mode: 'keep' }
    | { mode: 'replace'; file: File; previewUrl: string }
    | { mode: 'clear' }
  >({ mode: 'keep' });
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarChangeRef = useRef<HTMLButtonElement>(null);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  const persistedName = (user?.public_display_name || user?.full_name || '').trim();
  const authoritativeAvatar = resolveAuthenticatedAvatarDisplay({
    draft: avatarDraft,
    user,
  });
  const panelAvatarUrl = authoritativeAvatar.url;
  const avatarCacheBust = authoritativeAvatar.revision;
  const hasDisplayableAvatar = Boolean(panelAvatarUrl);
  const viewerAvatarUrl =
    avatarDraft.mode === 'replace'
      ? avatarDraft.previewUrl
      : panelAvatarUrl;
  const viewerCacheBust =
    avatarDraft.mode === 'replace' ? undefined : avatarCacheBust;
  const avatarUnchanged = avatarDraft.mode === 'keep';
  const nameUnchanged = nameDraft.trim() === persistedName;
  const quietPlanLabel = resolveQuietAccountPlanLabel(planTier);
  const currentModel = getAnalysisModelById(analysisModelId);
  const loginHref = buildSainaAuthHref(returnUrl, 'login');
  const registerHref = buildSainaAuthHref(returnUrl, 'register');

  const discardAvatarDraft = () => {
    setAvatarDraft((current) => {
      if (current.mode === 'replace') {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { mode: 'keep' };
    });
    setAvatarSaveState('idle');
    setAvatarError(null);
  };

  const commitAvatarDraft = () => {
    setAvatarDraft((current) => {
      if (current.mode === 'replace') {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { mode: 'keep' };
    });
  };

  useEffect(() => {
    if (!open || isGuest) return;
    setNameDraft(persistedName);
    setNameSaveState('idle');
    setNameError(null);
  }, [open, isGuest, persistedName]);

  useEffect(() => {
    if (!open || isGuest) return;
    discardAvatarDraft();
  }, [open, isGuest]);

  useEffect(() => {
    return () => {
      setAvatarDraft((current) => {
        if (current.mode === 'replace') {
          URL.revokeObjectURL(current.previewUrl);
        }
        return current;
      });
    };
  }, []);

  useEffect(() => {
    setEzaPrefs(getEzaUserPreferences(ownerUserId));
    return subscribeEzaUserPreferences(() => {
      setEzaPrefs(getEzaUserPreferences(ownerUserId));
    });
  }, [ownerUserId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (cropSourceFile || avatarViewerOpen) return;
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, cropSourceFile, avatarViewerOpen, nameDraft, persistedName, avatarDraft, nameSaveState, avatarSaveState]);

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

  const finishClose = () => {
    setAvatarViewerOpen(false);
    setCropSourceFile(null);
    discardAvatarDraft();
    setOpen(false);
    setModelOpen(false);
    setConfirmDiscard(false);
  };

  const close = () => {
    if (nameSaveState === 'saving' || avatarSaveState === 'saving') return;
    if (!isGuest && (!nameUnchanged || !avatarUnchanged)) {
      setConfirmDiscard(true);
      return;
    }
    finishClose();
  };

  useEffect(() => {
    if (!open) return;
    setSection('menu');
    setConfirmDiscard(false);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => returnFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')?.focus();
  }, [open, section, confirmDiscard]);

  const patchEzaPref = (patch: Partial<EzaUserPreferences>) => {
    setEzaPrefs(setEzaUserPreferences(ownerUserId, patch));
  };

  const savePublicDisplayName = async () => {
    if (!token || !user) return;
    setNameSaveState('saving');
    setNameError(null);
    const { patchPublicIdentity, publicIdentitySaveErrorMessage } = await import(
      '@/lib/eza/plan/fetchAuthMe'
    );
    const { setMemoryAuthToken } = await import('@/lib/eza/authTokenStore');
    setMemoryAuthToken(token);
    const result = await patchPublicIdentity(nameDraft);
    if (!result.ok) {
      setNameSaveState('error');
      setNameError(publicIdentitySaveErrorMessage(result.code));
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

  const savePublicAvatar = async () => {
    if (!token || !user || avatarUnchanged) return;
    setAvatarSaveState('saving');
    setAvatarError(null);
    const { uploadPublicAvatar, deletePublicAvatar, publicAvatarSaveErrorMessage } =
      await import('@/lib/eza/plan/fetchAuthMe');
    const { setMemoryAuthToken } = await import('@/lib/eza/authTokenStore');
    setMemoryAuthToken(token);

    const applyServerAvatar = (
      publicAvatarUrl: string | null,
      publicAvatarRevision: number
    ) => {
      patchAuthUser({
        public_avatar_url: publicAvatarUrl,
        public_avatar_revision: publicAvatarRevision,
      });
    };

    if (avatarDraft.mode === 'clear') {
      if (!user.public_avatar_url) {
        discardAvatarDraft();
        setAvatarSaveState('idle');
        return;
      }
      const result = await deletePublicAvatar();
      if (!result.ok) {
        setAvatarSaveState('error');
        setAvatarError(publicAvatarSaveErrorMessage(result.code));
        return;
      }
      applyServerAvatar(null, result.public_avatar_revision);
      commitAvatarDraft();
      setAvatarSaveState('saved');
      return;
    }

    if (avatarDraft.mode === 'replace') {
      const result = await uploadPublicAvatar(avatarDraft.file);
      if (!result.ok) {
        setAvatarSaveState('error');
        setAvatarError(publicAvatarSaveErrorMessage(result.code));
        return;
      }
      applyServerAvatar(result.public_avatar_url, result.public_avatar_revision);
      commitAvatarDraft();
      setAvatarSaveState('saved');
    }
  };

  const stageAvatarRemoval = () => {
    setAvatarDraft((current) => {
      if (current.mode === 'replace') {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { mode: 'clear' };
    });
    setAvatarSaveState('idle');
    setAvatarError(null);
  };

  const onAvatarInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAcceptedProfileAvatarFile(file)) {
      setAvatarSaveState('error');
      setAvatarError(publicAvatarSaveErrorMessage('unsupported_avatar_format'));
      return;
    }
    setAvatarError(null);
    setCropSourceFile(file);
  };

  const stageCroppedAvatar = (cropped: File) => {
    const previewUrl = URL.createObjectURL(cropped);
    setAvatarDraft((current) => {
      if (current.mode === 'replace') {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { mode: 'replace', file: cropped, previewUrl };
    });
    setAvatarSaveState('idle');
    setCropSourceFile(null);
  };

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (cropSourceFile || avatarViewerOpen) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (modelOpen) setModelOpen(false);
      else if (confirmDiscard) setConfirmDiscard(false);
      else close();
    }
    if (event.key === 'Tab') {
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="file"]), [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn('saina-profile-menu-root', hideTrigger && 'saina-profile-menu-root--host')}
    >
      {hideTrigger ? null : (
        <button
          type="button"
          className="saina-top-avatar-wrap saina-profile-menu-trigger"
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="dialog"
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
            <ProfileUserAvatar
              displayName={displayName}
              userId={ownerUserId}
              avatarUrl={panelAvatarUrl}
              cacheBust={avatarCacheBust}
              size="top"
            />
          )}
        </button>
      )}

      {open ? (
        <div ref={panelRef} className="saina-profile-menu saina-account-panel" data-testid="saina-profile-menu"
          data-section={section} role="dialog" aria-labelledby={titleId} onKeyDown={handlePanelKeyDown}
          onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
          <div className="saina-account-panel-heading">
            {section !== 'menu' && !confirmDiscard ? <button type="button" className="saina-account-icon-button"
              aria-label="Profil menüsüne dön" data-testid="saina-profile-back" onClick={() => { setSection('menu'); setModelOpen(false); }}><ArrowLeft size={18} aria-hidden /></button> : null}
            <h2 id={titleId}>{confirmDiscard ? 'Kaydedilmemiş değişiklikler' : { menu: 'Hesabım', notifications: 'Bildirimler', profile: 'Profilimi düzenle', settings: 'Ayarlar', plan: planTier === 'premium' ? 'Premium planım' : 'Planım' }[section]}</h2>
            <button type="button" className="saina-account-icon-button" aria-label="Profil panelini kapat" data-testid="saina-profile-close"
              disabled={nameSaveState === 'saving' || avatarSaveState === 'saving'} onClick={close}><X size={18} aria-hidden /></button>
          </div>
          <div className="saina-account-panel-content">
          {confirmDiscard ? <div role="alertdialog" aria-label="Kaydedilmemiş profil değişiklikleri" className="saina-account-discard">
            <p>Kaydedilmemiş profil değişikliklerin var.</p>
            <button type="button" className="saina-profile-menu-save" onClick={() => setConfirmDiscard(false)}>Düzenlemeye devam et</button>
            <button type="button" className="saina-profile-menu-item" data-testid="saina-profile-discard" onClick={finishClose}>Kaydetmeden kapat</button>
          </div> : <>
          {section === 'menu' || section === 'profile' ? <div className="saina-profile-menu-account-block">
            {isGuest ? <div className="saina-profile-menu-identity" data-testid="saina-profile-menu-identity">
              <ProfileIdentityMark isGuest displayName={displayName} /><div className="saina-profile-menu-identity-copy"><p className="saina-profile-menu-account-name">{SAINA_MENU_GUEST_LABEL}</p></div>
            </div> : <>
                <div
                  className="saina-profile-menu-identity"
                  data-testid="saina-profile-menu-identity"
                >
                  <ProfileIdentityMark
                    isGuest={false}
                    interactive={section === 'profile'}
                    displayName={displayName}
                    userId={ownerUserId}
                    avatarUrl={panelAvatarUrl}
                    avatarCacheBust={avatarCacheBust}
                    hasPhoto={hasDisplayableAvatar}
                    onAvatarView={() => setAvatarViewerOpen(true)}
                    onAvatarAdd={section === 'profile' ? openAvatarPicker : () => setSection('profile')}
                    avatarBusy={avatarSaveState === 'saving' || disabled}
                    avatarTriggerRef={avatarTriggerRef}
                  />
                  <div className="saina-profile-menu-identity-copy">
                    <p
                      className="saina-profile-menu-account-name"
                      data-testid="saina-profile-menu-public-name"
                    >
                      {displayName}
                    </p>
                    <HonorificMarker
                      honorific={user?.public_honorific}
                      size="sm"
                      testId="saina-profile-menu-honorific"
                    />
                    {user?.email ? (
                      <p
                        className="saina-profile-menu-email saina-profile-menu-row-note"
                        data-testid="saina-account-email"
                      >
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                </div>


            </>}
            {section === 'menu' && quietPlanLabel && !isGuest ? <p className="saina-profile-menu-row-note" data-testid="saina-profile-plan-summary">{quietPlanLabel}</p> : null}
            {section === 'profile' ? (isGuest ? <>                <ul className="saina-profile-menu-benefits">
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
                </div></> : <>                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  data-testid="saina-profile-avatar-input"
                  onChange={onAvatarInputChange}
                  disabled={disabled || avatarSaveState === 'saving'}
                />

                <div
                  className="saina-profile-menu-avatar-edit saina-profile-menu-row saina-profile-menu-row--stack"
                  data-testid="saina-profile-avatar-editor"
                >
                  <span className="saina-profile-menu-eyebrow saina-profile-menu-row-title">
                    Profil fotoğrafı
                  </span>
                  <div className="saina-profile-menu-avatar-actions">
                    <button
                      ref={avatarChangeRef}
                      type="button"
                      className="saina-profile-menu-save"
                      disabled={disabled || avatarSaveState === 'saving'}
                      onClick={openAvatarPicker}
                      data-testid="saina-profile-avatar-change"
                    >
                      Fotoğrafı değiştir
                    </button>
                    {panelAvatarUrl ? (
                      <button
                        type="button"
                        className="saina-profile-menu-avatar-remove"
                        disabled={disabled || avatarSaveState === 'saving'}
                        onClick={stageAvatarRemoval}
                        data-testid="saina-profile-avatar-remove"
                      >
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                  <span className="saina-profile-menu-row-note">
                    JPEG, PNG veya WebP. En fazla 2 MB.
                  </span>
                  <div className="saina-profile-menu-save-wrap">
                    <button
                      type="button"
                      className="saina-profile-menu-save"
                      disabled={
                        disabled || avatarSaveState === 'saving' || avatarUnchanged
                      }
                      onClick={() => void savePublicAvatar()}
                      data-testid="saina-profile-avatar-save"
                    >
                      {avatarSaveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                  </div>
                  {avatarSaveState === 'saved' ? (
                    <span className="saina-profile-menu-row-note" role="status">
                      Fotoğraf güncellendi.
                    </span>
                  ) : null}
                  {avatarError ? (
                    <span className="saina-profile-menu-row-note" role="alert">
                      {avatarError}
                    </span>
                  ) : null}
                </div>

                <div
                  className="saina-profile-menu-name-edit saina-profile-menu-row saina-profile-menu-row--stack"
                  data-testid="saina-public-name-editor"
                >
                  <label
                    className="saina-profile-menu-eyebrow saina-profile-menu-row-title"
                    htmlFor="saina-public-name-input"
                  >
                    Herkese açık ad
                  </label>
                  <input
                    id="saina-public-name-input"
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
                  <div className="saina-profile-menu-save-wrap">
                    <button
                      type="button"
                      className="saina-profile-menu-save"
                      disabled={
                        disabled || nameSaveState === 'saving' || nameUnchanged
                      }
                      onClick={() => void savePublicDisplayName()}
                      data-testid="saina-public-name-save"
                    >
                      {nameSaveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                  </div>
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
                </div></>) : null}
          </div> : null}
          {section === 'menu' ? <nav aria-label="Hesap seçenekleri" className="saina-account-menu">
            <button type="button" className="saina-profile-menu-item" data-testid="saina-profile-nav-notifications" onClick={() => setSection('notifications')}><Bell size={17} aria-hidden /><span>Bildirimler</span><ChevronRight size={14} aria-hidden /></button>
            <button type="button" className="saina-profile-menu-item" data-testid="saina-profile-nav-profile" onClick={() => setSection('profile')}><User size={17} aria-hidden /><span>Profilimi düzenle</span><ChevronRight size={14} aria-hidden /></button>
            <button type="button" className="saina-profile-menu-item" data-testid="saina-profile-nav-settings" onClick={() => setSection('settings')}><Settings size={17} aria-hidden /><span>Ayarlar</span><ChevronRight size={14} aria-hidden /></button>
            <button type="button" className="saina-profile-menu-item" data-testid="saina-profile-nav-plan" onClick={() => setSection('plan')}><CreditCard size={17} aria-hidden /><span>{planTier === 'premium' ? 'Premium planım' : 'Planım'}</span><ChevronRight size={14} aria-hidden /></button>
            {!isGuest ? <>              <button
                type="button"
                className="saina-profile-menu-item saina-profile-menu-logout"
                data-testid="saina-profile-logout"
                onClick={() => {
                  if (!nameUnchanged || !avatarUnchanged) { close(); return; }
                  finishClose();
                  logout();
                }}
              >
                <LogOut size={14} aria-hidden />
                <span>{SAINA_MENU_LOGOUT}</span>
              </button></> : <Link href={loginHref} className="saina-profile-menu-item" data-testid="saina-profile-login" onClick={close}>{SAINA_MENU_LOGIN}</Link>}
          </nav> : null}
          {section === 'notifications' ? <section aria-label="Bildirimler" data-testid="saina-notifications-panel"><SainaNotificationsContent notifications={notifications} /></section> : null}
          {section === 'settings' ? <>          <div
            className="saina-profile-menu-section"
            ref={settingsSectionRef}
            data-testid="saina-profile-settings-section"
          >
            <p className="saina-profile-menu-section-label">{SAINA_MENU_SETTINGS}</p>

            <div className="saina-profile-menu-setting">
              <div className="saina-profile-menu-setting-text">
                <span className="saina-profile-menu-row-title">{SAINA_SAFE_MODE_LABEL}</span>
                <span className="saina-profile-menu-row-note">{SAINA_SAFE_MODE_NOTE}</span>
              </div>
              <ProfileSettingSwitch
                checked={safeOnlyMode}
                onCheckedChange={(next) => onSafeOnlyModeChange?.(next)}
                disabled={disabled || !onSafeOnlyModeChange}
                label={SAINA_SAFE_MODE_LABEL}
                testId="saina-safe-mode-switch"
              />
            </div>

            <div className="saina-profile-menu-setting">
              <div className="saina-profile-menu-setting-text">
                <span className="saina-profile-menu-row-title">
                  {SAINA_EZA_VISIBILITY_LABEL}
                </span>
                <span className="saina-profile-menu-row-note">
                  {SAINA_EZA_VISIBILITY_NOTE}
                </span>
              </div>
              <ProfileSettingSwitch
                checked={ezaPrefs.ezaVisibilityEnabled}
                onCheckedChange={(next) => patchEzaPref({ ezaVisibilityEnabled: next })}
                disabled={disabled}
                label={SAINA_EZA_VISIBILITY_LABEL}
                testId="saina-eza-visibility-switch"
              />
            </div>

            <div className="saina-profile-menu-setting">
              <div className="saina-profile-menu-setting-text">
                <span className="saina-profile-menu-row-title">
                  {SAINA_EZA_PROCESSING_LABEL}
                </span>
                <span className="saina-profile-menu-row-note">
                  {SAINA_EZA_PROCESSING_NOTE}
                </span>
              </div>
              <ProfileSettingSwitch
                checked={ezaPrefs.ezaDataProcessingEnabled}
                onCheckedChange={(next) =>
                  patchEzaPref({ ezaDataProcessingEnabled: next })
                }
                disabled={disabled}
                label={SAINA_EZA_PROCESSING_LABEL}
                testId="saina-eza-processing-switch"
              />
            </div>
          </div>
          <div className="saina-profile-menu-section" ref={modelRef}>
            <span className="saina-profile-menu-row-title">{SAINA_ANALYSIS_MODEL_LABEL}</span>
            <button
              type="button"
              disabled={disabled || !onAnalysisModelChange}
              className="saina-profile-model-trigger"
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              aria-label={SAINA_ANALYSIS_MODEL_LABEL}
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
                      disabled={disabled || !onAnalysisModelChange}
                      className={cn(
                        'saina-profile-model-option',
                        active && 'saina-profile-model-option--active'
                      )}
                      data-testid={`saina-profile-model-${model.id}`}
                      onClick={() => {
                        onAnalysisModelChange?.(model.id);
                        setModelOpen(false);
                      }}
                    >
                      {model.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div></> : null}
          {section === 'plan' ? <>
            {quietPlanLabel && !isGuest ? <>              <div
                className="saina-profile-menu-meta-row"
                data-testid="saina-profile-plan-row"
              >
                <span className="saina-profile-menu-meta-label">
                  {SAINA_PROFILE_PLAN_EYEBROW}
                </span>
                <span
                  className="saina-profile-menu-meta-value"
                  data-testid="saina-profile-plan-value"
                >
                  {quietPlanLabel}
                </span>
              </div></> : <p className="saina-profile-menu-row-note">{isGuest ? SAINA_MENU_GUEST_LABEL : 'Plan bilgisi yükleniyor…'}</p>}
            {onUpgrade ? <button type="button" className="saina-profile-menu-item" onClick={() => { if (!nameUnchanged || !avatarUnchanged) { close(); return; } finishClose(); onUpgrade(); }}>Plan seçenekleri</button> : null}
            {isGuest ? <>                <ul className="saina-profile-menu-benefits">
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
                </div></> : null}
          </> : null}
          </>}
          </div>
        </div>
      ) : null}

      {cropSourceFile ? (
        <ProfileAvatarCropEditor
          file={cropSourceFile}
          open
          busy={avatarSaveState === 'saving'}
          onCancel={() => setCropSourceFile(null)}
          onApply={stageCroppedAvatar}
          returnFocusRef={avatarChangeRef}
        />
      ) : null}

      {avatarViewerOpen && hasDisplayableAvatar && viewerAvatarUrl ? (
        <ProfileAvatarViewer
          open
          displayName={displayName}
          avatarUrl={viewerAvatarUrl}
          cacheBust={viewerCacheBust}
          onClose={() => setAvatarViewerOpen(false)}
          onChangePhoto={openAvatarPicker}
          returnFocusRef={avatarTriggerRef}
        />
      ) : null}
    </div>
  );
}
