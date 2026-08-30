/**
 * Phase 8.8F — compact profile side panel + privacy-safe fallback avatar.
 * Profile photo upload uses durable backend storage (/api/auth/me/avatar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_EZA_PROCESSING_LABEL,
  SAINA_EZA_VISIBILITY_LABEL,
  SAINA_MENU_ACCOUNT,
  SAINA_SAFE_MODE_LABEL,
} from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID, STANDALONE_ANALYSIS_MODELS } from '@/lib/standaloneModels';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  token: 'tok' as string | null,
  logout: vi.fn(),
  setAuth: vi.fn(),
  patchAuthUser: vi.fn(),
  user: {
    user_id: 'user-88f',
    email: 'owner@example.com',
    full_name: 'Ada Lovelace',
    public_display_name: 'Ada Lovelace',
    public_honorific: 'curious',
    role: 'user',
  } as {
    user_id: string;
    email: string;
    full_name?: string;
    public_display_name?: string | null;
    public_honorific?: string | null;
    role: string;
  } | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/standalone',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthReady: authState.isAuthReady,
    token: authState.token,
    user: authState.user,
    logout: authState.logout,
    setAuth: authState.setAuth,
    patchAuthUser: authState.patchAuthUser,
    role: authState.user?.role ?? null,
  }),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: () => ({
    plan: 'plus',
    isPlus: true,
    isFree: false,
    isLoading: false,
    source: 'server',
    setPlan: vi.fn(),
    refreshPlan: vi.fn(),
  }),
}));

vi.mock('@/lib/eza/plan/useAccountEntitlements', () => ({
  useAccountEntitlements: () => ({
    entitlements: { tier: 'premium' },
    isLoading: false,
    refreshEntitlements: vi.fn(),
  }),
}));

vi.mock('@/lib/eza/profile/normalizeProfileAvatarFile', () => ({
  normalizeProfileAvatarFile: vi.fn(async (file: File) => file),
  isAcceptedProfileAvatarFile: vi.fn(() => true),
}));

vi.mock('@/components/mirror/ayna/ProfileAvatarCropEditor', () => ({
  default: ({
    onApply,
    onCancel,
  }: {
    onApply: (file: File) => void | Promise<void>;
    onCancel: () => void;
  }) => (
    <div data-testid="profile-avatar-crop-editor">
      <button
        type="button"
        data-testid="profile-avatar-crop-apply-mock"
        onClick={() => {
          const file = new File(['cropped'], 'c.jpg', { type: 'image/jpeg' });
          void onApply(file);
        }}
      >
        mock-apply
      </button>
      <button type="button" data-testid="profile-avatar-crop-cancel-mock" onClick={onCancel}>
        mock-cancel
      </button>
    </div>
  ),
}));

vi.mock('@/lib/eza/plan/fetchAuthMe', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/plan/fetchAuthMe')>(
    '@/lib/eza/plan/fetchAuthMe'
  );
  return {
    ...actual,
    patchPublicIdentity: vi.fn(),
    uploadPublicAvatar: vi.fn(),
    deletePublicAvatar: vi.fn(),
    refreshAuthUserProfile: vi.fn(async (base) => base),
  };
});

import SainaProfileMenu from '@/components/saina/SainaProfileMenu';
import {
  patchPublicIdentity,
  uploadPublicAvatar,
  deletePublicAvatar,
} from '@/lib/eza/plan/fetchAuthMe';

const root = join(process.cwd());
function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

function openMenu(
  overrides?: Partial<{
    safeOnlyMode: boolean;
    onSafeOnlyModeChange: (enabled: boolean) => void;
    analysisModelId: string;
    onAnalysisModelChange: (modelId: string) => void;
  }>
) {
  const onSafeOnlyModeChange = overrides?.onSafeOnlyModeChange ?? vi.fn();
  const onAnalysisModelChange = overrides?.onAnalysisModelChange ?? vi.fn();
  render(
    <SainaProfileMenu
      safeOnlyMode={overrides?.safeOnlyMode ?? false}
      onSafeOnlyModeChange={onSafeOnlyModeChange}
      analysisModelId={overrides?.analysisModelId ?? DEFAULT_ANALYSIS_MODEL_ID}
      onAnalysisModelChange={onAnalysisModelChange}
    />
  );
  fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
  return { onSafeOnlyModeChange, onAnalysisModelChange };
}

describe('Phase 8.8F profile side panel', () => {
  beforeEach(() => {
    clearEzaUserPreferencesForTests();
    authState.isAuthenticated = true;
    authState.isAuthReady = true;
    authState.token = 'tok';
    authState.logout.mockReset();
    authState.setAuth.mockReset();
    authState.patchAuthUser.mockReset();
    authState.user = {
      user_id: 'user-88f',
      email: 'owner@example.com',
      full_name: 'Ada Lovelace',
      public_display_name: 'Ada Lovelace',
      public_honorific: 'curious',
      role: 'user',
    };
    vi.mocked(patchPublicIdentity).mockReset();
    vi.mocked(uploadPublicAvatar).mockReset();
    vi.mocked(deletePublicAvatar).mockReset();
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:avatar-preview'),
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-preview');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  it('uses compact desktop dimensions without a gold frame', () => {
    const css = read('styles/saina-profile-panel.css');
    expect(css).toContain('@media (min-width: 900px)');
    expect(css).toContain('width: 296px');
    expect(css).toContain('top: 68px');
    expect(css).toContain('right: 18px');
    expect(css).toContain('max-height: calc(100dvh - 90px)');
    expect(css).toContain('border-radius: 18px');
    expect(css).toContain('blur(20px) saturate(72%)');
    expect(css).toContain('0 20px 48px rgba(0, 0, 0, 0.22)');
    expect(css).toContain("min-width: 0");
    expect(css).toContain('max-width: 32px');
    expect(css).not.toMatch(/gold frame|#ffd700/i);
    expect(read('app/standalone/SainaAppRootLayout.tsx')).toContain(
      "import '@/styles/saina-profile-panel.css'"
    );
  });

  it('shows public name and read-only honorific as identity, not plan', () => {
    openMenu();
    const panel = screen.getByTestId('saina-profile-menu');
    const identity = screen.getByTestId('saina-profile-menu-identity');

    expect(screen.getByTestId('saina-profile-menu-public-name')).toHaveTextContent(
      'Ada Lovelace'
    );
    expect(screen.getByTestId('saina-profile-menu-honorific')).toHaveTextContent('Meraklı');
    expect(screen.getByTestId('saina-profile-menu-honorific')).toHaveAttribute(
      'data-honorific',
      'curious'
    );
    expect(within(identity).queryByText(/Premium|Free|Mini|Standard/i)).toBeNull();
    expect(screen.queryByText(SAINA_MENU_ACCOUNT)).toBeNull();

    const honorific = screen.getByTestId('saina-profile-menu-honorific');
    expect(honorific.tagName).toBe('SPAN');
    expect(honorific.closest('button')).toBeNull();
    expect(honorific.closest('select')).toBeNull();
    expect(honorific.closest('[role="listbox"]')).toBeNull();
    expect(panel.querySelector('select')).toBeNull();

    expect(screen.getByTestId('saina-profile-plan-row')).toHaveTextContent('Plan');
    expect(screen.getByTestId('saina-profile-plan-value')).toHaveTextContent('Premium');
    expect(screen.getByTestId('saina-account-email')).toHaveTextContent('owner@example.com');
  });

  it('shows Bilgin as a stronger read-only marker without a selector', () => {
    authState.user = {
      ...authState.user!,
      public_honorific: 'bilgin',
    };
    openMenu();
    const marker = screen.getByTestId('saina-profile-menu-honorific');
    expect(marker).toHaveTextContent('Bilgin');
    expect(marker).toHaveAttribute('data-honorific', 'bilgin');
    expect(marker.className).toContain('bilign-honorific--bilgin');
    expect(screen.queryByRole('combobox', { name: /meraklı|bilgin|unvan/i })).toBeNull();
  });

  it('keeps public display-name editing on the existing identity contract', async () => {
    vi.mocked(patchPublicIdentity).mockResolvedValue({
      ok: true,
      public_display_name: 'Yeni Ad',
      resolved_public_display_name: 'Yeni Ad',
    });
    openMenu();

    const save = screen.getByTestId('saina-public-name-save');
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByTestId('saina-public-name-input'), {
      target: { value: 'Yeni Ad' },
    });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(patchPublicIdentity).toHaveBeenCalledWith('Yeni Ad');
    });
    expect(authState.setAuth).toHaveBeenCalled();
  });

  it('rejects extra honorific on the owner PATCH contract', () => {
    const fetchAuth = read('lib/eza/plan/fetchAuthMe.ts');
    const patchStart = fetchAuth.indexOf('export async function patchPublicIdentity');
    const patchEnd = fetchAuth.indexOf('export function publicIdentitySaveErrorMessage');
    const patchFn = fetchAuth.slice(patchStart, patchEnd);
    expect(patchFn).toContain('body: { public_display_name: publicDisplayName }');
    expect(patchFn).not.toContain('public_honorific');

    const backendTest = readFileSync(
      join(root, '../backend/tests/test_public_honorific.py'),
      'utf8'
    );
    expect(backendTest).toContain('test_owner_patch_rejects_honorific_extra');
    expect(backendTest).toContain(
      '"public_honorific" not in PublicIdentityUpdateRequest.model_fields'
    );
  });

  it('toggles boolean settings with compact switches, not segmented controls', () => {
    const { onSafeOnlyModeChange } = openMenu();
    const panel = screen.getByTestId('saina-profile-menu');

    expect(panel.querySelector('.saina-safe-mode-segmented')).toBeNull();
    expect(screen.queryByTestId('saina-safe-mode-on')).toBeNull();

    const safe = screen.getByTestId('saina-safe-mode-switch');
    expect(safe).toHaveAttribute('role', 'switch');
    expect(safe).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(safe);
    expect(onSafeOnlyModeChange).toHaveBeenCalledWith(true);

    const visibility = screen.getByTestId('saina-eza-visibility-switch');
    const processing = screen.getByTestId('saina-eza-processing-switch');
    expect(visibility).toHaveAttribute('role', 'switch');
    expect(processing).toHaveAttribute('role', 'switch');
    expect(visibility).toHaveAttribute('aria-checked', 'true');
    expect(processing).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(visibility);
    fireEvent.click(processing);
    expect(visibility).toHaveAttribute('aria-checked', 'false');
    expect(processing).toHaveAttribute('aria-checked', 'false');

    expect(screen.getByText(SAINA_SAFE_MODE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(SAINA_EZA_VISIBILITY_LABEL)).toBeInTheDocument();
    expect(screen.getByText(SAINA_EZA_PROCESSING_LABEL)).toBeInTheDocument();
  });

  it('keeps model selection and logout working', () => {
    const nextModel = STANDALONE_ANALYSIS_MODELS[1];
    const { onAnalysisModelChange } = openMenu();

    expect(screen.getByText(SAINA_ANALYSIS_MODEL_LABEL)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('saina-profile-model-trigger'));
    fireEvent.click(screen.getByTestId(`saina-profile-model-${nextModel.id}`));
    expect(onAnalysisModelChange).toHaveBeenCalledWith(nextModel.id);

    fireEvent.click(screen.getByTestId('saina-profile-logout'));
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });

  it('stages avatar upload until save and avoids local-only persistence', () => {
    openMenu();
    const panel = screen.getByTestId('saina-profile-menu');
    const src = read('components/saina/SainaProfileMenu.tsx');

    expect(within(panel).getByTestId('bilign-profile-avatar')).toBeInTheDocument();
    expect(panel.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText(/Fotoğrafı değiştir/i)).toBeInTheDocument();
    expect(screen.getByTestId('saina-profile-avatar-save')).toBeInTheDocument();
    expect(src).not.toContain('FileReader');
    expect(src).not.toMatch(/localStorage\.setItem\([^)]*avatar/i);
    expect(src).toContain('uploadPublicAvatar');
    expect(src).toContain('savePublicAvatar');
    expect(src).toContain('ProfileUserAvatar');
    expect(src).toContain('saina-profile-menu-identity-orbit');
  });

  it('uploads avatar only after save and updates auth state', async () => {
    vi.mocked(uploadPublicAvatar).mockResolvedValue({
      ok: true,
      public_avatar_url: 'https://api.example.com/api/public/profile-avatars/u.jpg',
      public_avatar_revision: 5,
    });

    openMenu();
    const file = new File(['avatar'], 'me.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('saina-profile-avatar-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply-mock'));

    await waitFor(() => {
      expect(screen.getByTestId('saina-profile-avatar-save')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('saina-profile-avatar-save'));

    await waitFor(() => {
      expect(uploadPublicAvatar).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(authState.patchAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          public_avatar_url: 'https://api.example.com/api/public/profile-avatars/u.jpg',
          public_avatar_revision: 5,
        })
      );
    });
  });

  it('discards staged avatar when the panel closes without save', async () => {
    vi.mocked(uploadPublicAvatar).mockResolvedValue({
      ok: true,
      public_avatar_url: 'https://api.example.com/api/public/profile-avatars/u.jpg',
      public_avatar_revision: 5,
    });

    openMenu();
    const file = new File(['avatar'], 'me.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('saina-profile-avatar-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply-mock'));

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));

    expect(uploadPublicAvatar).not.toHaveBeenCalled();
    expect(authState.patchAuthUser).not.toHaveBeenCalled();
  });

  it('leaves mobile dropdown metrics, public profile, Discover, and Yansı identity alone', () => {
    const mirror = read('styles/saina-mirror.css');
    const panelCss = read('styles/saina-profile-panel.css');
    const menuSrc = read('components/saina/SainaProfileMenu.tsx');
    const profile = read('components/mirror/ayna/AuthorPublishedYansiProfile.tsx');
    const discover = read('components/saina/SainaDiscoverCard.tsx');
    const yansi = read('components/saina/SainaHeroScene.tsx');
    const fetchAuthor = read('lib/eza/mirror-network/fetchAuthorPublished.ts');

    expect(mirror).toContain('.saina-profile-menu {');
    expect(mirror).toContain('min-width: 17.5rem');
    expect(mirror).toContain('top: calc(100% + 0.5rem)');
    expect(panelCss.indexOf('@media (min-width: 900px)')).toBeGreaterThan(
      panelCss.indexOf('.saina-profile-menu-identity')
    );
    expect(menuSrc).toContain('ProfileAvatarCropEditor');
    expect(menuSrc).toContain('ProfileAvatarViewer');
    expect(menuSrc).toContain('stageCroppedAvatar');

    expect(profile).toContain('HonorificMarker');
    expect(profile).toContain('ProfileUserAvatar');
    expect(profile).toContain('useResolvedProfileAvatar');
    expect(discover).toContain('HonorificMarker');
    expect(yansi).toContain('saina-yansi-identity-name');
    expect(yansi).toContain('HonorificMarker');
    expect(yansi).toContain('ProfileUserAvatar');
    expect(fetchAuthor).toContain('displayName');
    expect(fetchAuthor).toContain('publicHonorific');
    expect(fetchAuthor).toContain('publicAvatarUrl');
    expect(fetchAuthor.toLowerCase()).not.toContain('author.email');
  });
});
