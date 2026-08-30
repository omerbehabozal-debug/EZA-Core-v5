'use client';

import '@/styles/saina-profile-panel.css';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, User } from 'lucide-react';
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
import { normalizeProfileAvatarFile } from '@/lib/eza/profile/normalizeProfileAvatarFile';
import { publicAvatarSaveErrorMessage, refreshAuthUserProfile } from '@/lib/eza/plan/fetchAuthMe';
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
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  disabled?: boolean;
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
  onAvatarPick,
  avatarBusy,
}: {
  isGuest: boolean;
  displayName: string;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarCacheBust?: number | string;
  onAvatarPick?: () => void;
  avatarBusy?: boolean;
}) {
  return (
    <div className="saina-profile-menu-identity-mark">
      <svg
        className="saina-profile-menu-identity-orbit saina-profile-menu-identity-orbit--outer"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden
      >
        <path
          d="M36 6 L54.5 13.5 L65.5 29.5 L62 48.5 L46.5 62 L27.5 64.5 L12 52.5 L7.5 33.5 L18 15.5 Z"
          stroke="rgba(183,137,73,0.48)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        className="saina-profile-menu-identity-orbit saina-profile-menu-identity-orbit--inner"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden
      >
        <path
          d="M36 10 L51 16.5 L60 30 L57 46 L44 57 L28 58.5 L16 48 L13 32.5 L22.5 18 Z"
          stroke="rgba(208,161,91,0.72)"
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isGuest ? (
        <div className="saina-profile-menu-identity-face saina-profile-menu-identity-face--guest">
          <User size={22} />
        </div>
      ) : (
        <button
          type="button"
          className="saina-profile-menu-identity-face-btn"
          onClick={onAvatarPick}
          disabled={avatarBusy}
          aria-label="Profil fotoğrafını değiştir"
          data-testid="saina-profile-avatar-trigger"
        >
          <ProfileUserAvatar
            displayName={displayName}
            userId={userId}
            avatarUrl={avatarUrl}
            cacheBust={avatarCacheBust}
            size="lg"
            className="saina-profile-menu-identity-face"
          />
        </button>
      )}
    </div>
  );
}

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
  const [avatarStaging, setAvatarStaging] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<
    | { mode: 'keep' }
    | { mode: 'replace'; file: File; previewUrl: string }
    | { mode: 'clear' }
  >({ mode: 'keep' });
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const persistedName = (user?.public_display_name || user?.full_name || '').trim();
  const persistedAvatarUrl = (user?.public_avatar_url || '').trim() || null;
  const avatarCacheBust = user?.public_avatar_revision;
  const panelAvatarUrl =
    avatarDraft.mode === 'replace'
      ? avatarDraft.previewUrl
      : avatarDraft.mode === 'clear'
        ? null
        : displayAvatarUrl ?? persistedAvatarUrl;
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

  const commitAvatarDraft = (nextUrl: string | null) => {
    setDisplayAvatarUrl(nextUrl);
    setAvatarDraft((current) => {
      if (current.mode === 'replace') {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { mode: 'keep' };
    });
  };

  useEffect(() => {
    setDisplayAvatarUrl(persistedAvatarUrl);
  }, [persistedAvatarUrl]);

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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
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
    discardAvatarDraft();
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

    const applyAvatarSession = async (
      publicAvatarUrl: string | null,
      revision: number
    ) => {
      patchAuthUser({
        public_avatar_url: publicAvatarUrl,
        public_avatar_revision: revision,
      });
      const hydrated = await refreshAuthUserProfile({
        email: user.email,
        role: user.role,
        user_id: user.user_id,
        full_name: user.full_name,
        public_display_name: user.public_display_name,
        public_avatar_url: publicAvatarUrl,
        public_avatar_revision: revision,
        public_honorific: user.public_honorific,
      });
      patchAuthUser({
        public_display_name: hydrated.public_display_name,
        public_honorific: hydrated.public_honorific,
        public_avatar_url: publicAvatarUrl,
        public_avatar_revision: revision,
      });
    };

    if (avatarDraft.mode === 'clear') {
      if (!persistedAvatarUrl) {
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
      await applyAvatarSession(null, Date.now());
      commitAvatarDraft(null);
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
      const revision = Date.now();
      await applyAvatarSession(result.public_avatar_url, revision);
      commitAvatarDraft(result.public_avatar_url);
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

  const onAvatarInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarStaging(true);
    setAvatarError(null);
    try {
      const normalized = await normalizeProfileAvatarFile(file);
      const previewUrl = URL.createObjectURL(normalized);
      setAvatarDraft((current) => {
        if (current.mode === 'replace') {
          URL.revokeObjectURL(current.previewUrl);
        }
        return { mode: 'replace', file: normalized, previewUrl };
      });
      setAvatarSaveState('idle');
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : undefined;
      setAvatarSaveState('error');
      setAvatarError(publicAvatarSaveErrorMessage(code));
    } finally {
      setAvatarStaging(false);
    }
  };

  return (
    <div ref={rootRef} className="saina-profile-menu-root">
      <button
        type="button"
        className="saina-top-avatar-wrap saina-profile-menu-trigger"
        onClick={() => (open ? close() : setOpen(true))}
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
          <ProfileUserAvatar
            displayName={displayName}
            userId={ownerUserId}
            avatarUrl={panelAvatarUrl}
            cacheBust={avatarDraft.mode === 'keep' ? avatarCacheBust : undefined}
            size="top"
          />
        )}
        <span className="saina-status-dot" aria-hidden />
      </button>

      {open ? (
        <div className="saina-profile-menu" data-testid="saina-profile-menu">
          <div className="saina-profile-menu-account-block">
            {isGuest ? (
              <>
                <div
                  className="saina-profile-menu-identity"
                  data-testid="saina-profile-menu-identity"
                >
                  <ProfileIdentityMark isGuest displayName={displayName} />
                  <div className="saina-profile-menu-identity-copy">
                    <p className="saina-profile-menu-account-name">{SAINA_MENU_GUEST_LABEL}</p>
                  </div>
                </div>
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
                <div
                  className="saina-profile-menu-identity"
                  data-testid="saina-profile-menu-identity"
                >
                  <ProfileIdentityMark
                    isGuest={false}
                    displayName={displayName}
                    userId={ownerUserId}
                    avatarUrl={panelAvatarUrl}
                    avatarCacheBust={avatarDraft.mode === 'keep' ? avatarCacheBust : undefined}
                    onAvatarPick={() => avatarInputRef.current?.click()}
                    avatarBusy={avatarStaging || avatarSaveState === 'saving' || disabled}
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

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
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
                      type="button"
                      className="saina-profile-menu-save"
                      disabled={disabled || avatarSaveState === 'saving'}
                      onClick={() => avatarInputRef.current?.click()}
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
                </div>
              </>
            )}
          </div>

          <hr className="saina-profile-menu-rule" />

          <div className="saina-profile-menu-section">
            <p className="saina-profile-menu-section-label">{SAINA_MENU_SETTINGS}</p>

            <div className="saina-profile-menu-setting">
              <div className="saina-profile-menu-setting-text">
                <span className="saina-profile-menu-row-title">{SAINA_SAFE_MODE_LABEL}</span>
                <span className="saina-profile-menu-row-note">{SAINA_SAFE_MODE_NOTE}</span>
              </div>
              <ProfileSettingSwitch
                checked={safeOnlyMode}
                onCheckedChange={onSafeOnlyModeChange}
                disabled={disabled}
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

          {!isGuest && quietPlanLabel ? (
            <>
              <hr className="saina-profile-menu-rule" />
              <div
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
              </div>
            </>
          ) : null}

          <hr className="saina-profile-menu-rule" />

          <div className="saina-profile-menu-section" ref={modelRef}>
            <span className="saina-profile-menu-row-title">{SAINA_ANALYSIS_MODEL_LABEL}</span>
            <button
              type="button"
              disabled={disabled}
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

          {!isGuest ? (
            <>
              <hr className="saina-profile-menu-rule" />
              <button
                type="button"
                className="saina-profile-menu-item saina-profile-menu-logout"
                data-testid="saina-profile-logout"
                onClick={() => {
                  close();
                  logout();
                }}
              >
                <LogOut size={14} aria-hidden />
                <span>{SAINA_MENU_LOGOUT}</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
