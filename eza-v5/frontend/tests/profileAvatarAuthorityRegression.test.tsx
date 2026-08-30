/**
 * Server-authoritative avatar save regression — exercises real AuthContext state.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/lib/eza/localIdentityScope';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';
import SainaProfileMenu from '@/components/saina/SainaProfileMenu';

const BASE_URL = 'https://api.example.com/api/public/profile-avatars/user-88f.jpg';

const authMocks = vi.hoisted(() => ({
  validateAuthSession: vi.fn(),
  uploadPublicAvatar: vi.fn(),
  deletePublicAvatar: vi.fn(),
}));

vi.mock('@/lib/eza/plan/fetchAuthMe', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/plan/fetchAuthMe')>(
    '@/lib/eza/plan/fetchAuthMe'
  );
  return {
    ...actual,
    validateAuthSession: authMocks.validateAuthSession,
    uploadPublicAvatar: authMocks.uploadPublicAvatar,
    deletePublicAvatar: authMocks.deletePublicAvatar,
    patchPublicIdentity: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/standalone',
  useSearchParams: () => new URLSearchParams(),
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

vi.mock('@/lib/eza/conversation-tree/mergeGuestConversationTree', () => ({
  mergeGuestConversationTree: vi.fn(async () => ({ ok: true })),
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

function AuthAvatarProbe() {
  const { user, patchAuthUser } = useAuth();
  useEffect(() => {
    (window as unknown as { __patchAuthUser?: typeof patchAuthUser }).__patchAuthUser =
      patchAuthUser;
  }, [patchAuthUser]);
  return (
    <div
      data-testid="auth-avatar-probe"
      data-url={user?.public_avatar_url ?? ''}
      data-revision={String(user?.public_avatar_revision ?? 0)}
    />
  );
}

function Harness() {
  return (
    <AuthProvider>
      <AuthAvatarProbe />
      <SainaProfileMenu
        safeOnlyMode={false}
        onSafeOnlyModeChange={vi.fn()}
        analysisModelId="gpt-4o-mini"
        onAnalysisModelChange={vi.fn()}
      />
    </AuthProvider>
  );
}

function makeToken(): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-88f' })
  );
  return `header.${payload}.signature`;
}

function seedAuth(user: {
  user_id: string;
  email: string;
  role: string;
  public_display_name: string;
  public_avatar_url?: string | null;
  public_avatar_revision?: number;
}) {
  localStorage.setItem(TOKEN_STORAGE_KEY, makeToken());
  localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      ...user,
      public_honorific: 'curious',
    })
  );
}

function readProbe() {
  const probe = screen.getByTestId('auth-avatar-probe');
  return {
    url: probe.getAttribute('data-url') || '',
    revision: Number(probe.getAttribute('data-revision') || '0'),
  };
}

function readHeaderAvatarImgSrc(): string | null {
  const trigger = screen.getByTestId('saina-profile-menu-trigger');
  const img = within(trigger).getByTestId('bilign-profile-avatar-photo') as HTMLImageElement;
  return img.getAttribute('src');
}

describe('profile avatar authority regression', () => {
  beforeEach(() => {
    clearEzaUserPreferencesForTests();
    localStorage.clear();
    authMocks.validateAuthSession.mockReset();
    authMocks.uploadPublicAvatar.mockReset();
    authMocks.deletePublicAvatar.mockReset();
    seedAuth({
      user_id: 'user-88f',
      email: 'owner@example.com',
      role: 'user',
      public_display_name: 'Ada Lovelace',
      public_avatar_url: BASE_URL,
      public_avatar_revision: 4,
    });
    authMocks.validateAuthSession.mockResolvedValue({
      status: 'valid',
      session: {
        user_id: 'user-88f',
        email: 'owner@example.com',
        role: 'user',
        mirror_plan: 'plus',
        public_display_name: 'Ada Lovelace',
        public_avatar_url: BASE_URL,
        public_avatar_revision: 4,
        public_honorific: 'curious',
      },
    });
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:preview-b'),
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-b');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  it('save keeps B/rev5 after preview removal and rejects stale /me rev4', async () => {
    authMocks.uploadPublicAvatar.mockResolvedValue({
      ok: true,
      public_avatar_url: BASE_URL,
      public_avatar_revision: 5,
    });

    render(<Harness />);
    await waitFor(() => {
      expect(readProbe().revision).toBe(4);
    });

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const file = new File(['avatar-b'], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('saina-profile-avatar-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply-mock'));

    await waitFor(() => {
      expect(readHeaderAvatarImgSrc()?.startsWith('blob:')).toBe(true);
    });

    fireEvent.click(screen.getByTestId('saina-profile-avatar-save'));

    await waitFor(() => {
      expect(authMocks.uploadPublicAvatar).toHaveBeenCalled();
      expect(readProbe().revision).toBe(5);
      expect(readHeaderAvatarImgSrc()).toContain('v=5');
      expect(readHeaderAvatarImgSrc()).not.toBe('blob:preview-b');
    });

    const patchAuthUser = (window as unknown as { __patchAuthUser?: (patch: object) => void })
      .__patchAuthUser;
    expect(patchAuthUser).toBeTypeOf('function');
    await act(async () => {
      patchAuthUser?.({
        public_avatar_url: BASE_URL,
        public_avatar_revision: 4,
      });
    });

    expect(readProbe().revision).toBe(5);
    expect(readHeaderAvatarImgSrc()).toContain('v=5');

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));

    await waitFor(() => {
      expect(readProbe().revision).toBe(5);
      expect(readHeaderAvatarImgSrc()).toContain('v=5');
    });
  });

  it('cancel without save returns to A/rev4', async () => {
    render(<Harness />);
    await waitFor(() => expect(readProbe().revision).toBe(4));

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const file = new File(['avatar-b'], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('saina-profile-avatar-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply-mock'));

    await waitFor(() => {
      expect(readHeaderAvatarImgSrc()?.startsWith('blob:')).toBe(true);
    });

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));

    await waitFor(() => {
      expect(authMocks.uploadPublicAvatar).not.toHaveBeenCalled();
      expect(readProbe().revision).toBe(4);
      expect(readHeaderAvatarImgSrc()).toContain('v=4');
    });
  });

  it('save failure keeps preview B for retry', async () => {
    authMocks.uploadPublicAvatar.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR' });

    render(<Harness />);
    await waitFor(() => expect(readProbe().revision).toBe(4));

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const file = new File(['avatar-b'], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('saina-profile-avatar-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply-mock'));
    fireEvent.click(screen.getByTestId('saina-profile-avatar-save'));

    await waitFor(() => {
      expect(readProbe().revision).toBe(4);
      expect(readHeaderAvatarImgSrc()?.startsWith('blob:')).toBe(true);
    });
  });

  it('removal increments revision and clears avatar', async () => {
    authMocks.deletePublicAvatar.mockResolvedValue({ ok: true, public_avatar_revision: 6 });

    render(<Harness />);
    await waitFor(() => expect(readProbe().revision).toBe(4));

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-profile-avatar-remove'));
    fireEvent.click(screen.getByTestId('saina-profile-avatar-save'));

    await waitFor(() => {
      expect(authMocks.deletePublicAvatar).toHaveBeenCalled();
      expect(readProbe().revision).toBe(6);
      expect(readProbe().url).toBe('');
      expect(within(screen.getByTestId('saina-profile-menu-trigger')).queryByTestId('bilign-profile-avatar-photo')).toBeNull();
    });
  });
});
