/**
 * Avatar UX audit remediation — focus traps, menu flows, sizing regression.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileAvatarCropEditor from '@/components/mirror/ayna/ProfileAvatarCropEditor';
import ProfileAvatarViewer from '@/components/mirror/ayna/ProfileAvatarViewer';
import SainaProfileMenu from '@/components/saina/SainaProfileMenu';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';

const cropMocks = vi.hoisted(() => ({
  loadOrientedAvatarImage: vi.fn(),
  createOrientedAvatarPreviewUrl: vi.fn(),
  renderAvatarCropToFile: vi.fn(),
  releaseOrientedAvatarImage: vi.fn(),
}));

vi.mock('@/lib/eza/profile/avatarCrop', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/profile/avatarCrop')>(
    '@/lib/eza/profile/avatarCrop'
  );
  return {
    ...actual,
    loadOrientedAvatarImage: cropMocks.loadOrientedAvatarImage,
    createOrientedAvatarPreviewUrl: cropMocks.createOrientedAvatarPreviewUrl,
    renderAvatarCropToFile: cropMocks.renderAvatarCropToFile,
    releaseOrientedAvatarImage: cropMocks.releaseOrientedAvatarImage,
  };
});

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  token: 'tok' as string | null,
  logout: vi.fn(),
  setAuth: vi.fn(),
  patchAuthUser: vi.fn(),
  user: {
    user_id: 'user-rem',
    email: 'owner@example.com',
    full_name: 'Ada Lovelace',
    public_display_name: 'Ada Lovelace',
    public_honorific: 'curious',
    public_avatar_url: '/api/public/profile-avatars/user-rem.jpg',
    public_avatar_revision: 3,
    role: 'user',
  } as {
    user_id: string;
    email: string;
    full_name?: string;
    public_display_name?: string | null;
    public_honorific?: string | null;
    public_avatar_url?: string | null;
    public_avatar_revision?: number;
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

function readCss(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('ProfileAvatarCropEditor focus trap', () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'Fotoğrafı değiştir';
  document.body.appendChild(trigger);

  beforeEach(() => {
    cropMocks.loadOrientedAvatarImage.mockReset();
    cropMocks.createOrientedAvatarPreviewUrl.mockReset();
    cropMocks.renderAvatarCropToFile.mockReset();
    cropMocks.releaseOrientedAvatarImage.mockReset();
    cropMocks.loadOrientedAvatarImage.mockResolvedValue({
      bitmap: { close: vi.fn() } as unknown as ImageBitmap,
      width: 800,
      height: 1200,
    });
    cropMocks.createOrientedAvatarPreviewUrl.mockResolvedValue('blob:oriented-preview');
    trigger.focus();
  });

  it('opens with focus inside and restores trigger on close', async () => {
    const onCancel = vi.fn();
    const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' });
    const { unmount } = render(
      <ProfileAvatarCropEditor
        file={file}
        open
        onCancel={onCancel}
        onApply={vi.fn()}
        returnFocusRef={{ current: trigger }}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-cancel')).toHaveFocus();
    });

    const zoom = screen.getByTestId('profile-avatar-crop-zoom');
    const apply = screen.getByTestId('profile-avatar-crop-apply');

    apply.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
    expect(zoom).toHaveFocus();

    zoom.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(apply).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    unmount();
    expect(trigger).toHaveFocus();
  });
});

describe('ProfileAvatarViewer focus trap', () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'avatar';
  document.body.appendChild(trigger);

  beforeEach(() => {
    trigger.focus();
    document.body.style.overflow = '';
  });

  it('traps focus, closes on Escape, and restores body scroll', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ProfileAvatarViewer
        open
        displayName="Ada"
        avatarUrl="/api/public/profile-avatars/u.jpg"
        onClose={onClose}
        onChangePhoto={vi.fn()}
        returnFocusRef={{ current: trigger }}
      />
    );
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-viewer-close')).toHaveFocus();
    });

    const close = screen.getByTestId('profile-avatar-viewer-close');
    const change = screen.getByTestId('profile-avatar-viewer-change');
    change.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(change).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  it('restores body scroll on backdrop close', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ProfileAvatarViewer
        open
        displayName="Ada"
        avatarUrl="/api/public/profile-avatars/u.jpg"
        onClose={onClose}
      />
    );
    fireEvent.mouseDown(screen.getByTestId('profile-avatar-viewer-backdrop'));
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('ProfileAvatarCropEditor pinch integration', () => {
  it('uses pointer gesture module for viewport handlers', async () => {
    const gesture = await import('@/lib/eza/profile/avatarCropGesture');
    expect(gesture.avatarCropGesturePointerDown).toBeTypeOf('function');
    expect(gesture.avatarCropGesturePointerMove).toBeTypeOf('function');
    expect(gesture.avatarCropGesturePointerUp).toBeTypeOf('function');
  });
});

describe('SainaProfileMenu avatar interactions', () => {
  beforeEach(() => {
    authState.user = {
      user_id: 'user-rem',
      email: 'owner@example.com',
      full_name: 'Ada Lovelace',
      public_display_name: 'Ada Lovelace',
      public_honorific: 'curious',
      public_avatar_url: '/api/public/profile-avatars/user-rem.jpg',
      public_avatar_revision: 3,
      role: 'user',
    };
    cropMocks.loadOrientedAvatarImage.mockResolvedValue({
      bitmap: { close: vi.fn() } as unknown as ImageBitmap,
      width: 800,
      height: 1200,
    });
    cropMocks.createOrientedAvatarPreviewUrl.mockResolvedValue('blob:oriented-preview');
  });

  it('saved avatar opens viewer without invoking file picker', async () => {
    render(
      <SainaProfileMenu
        safeOnlyMode={false}
        onSafeOnlyModeChange={vi.fn()}
        analysisModelId={DEFAULT_ANALYSIS_MODEL_ID}
        onAnalysisModelChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const input = screen.getByTestId('saina-profile-avatar-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('saina-profile-avatar-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-viewer')).toBeInTheDocument();
    });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('no avatar opens file selection flow', async () => {
    authState.user = {
      ...authState.user!,
      public_avatar_url: null,
      public_avatar_revision: undefined,
    };
    render(
      <SainaProfileMenu
        safeOnlyMode={false}
        onSafeOnlyModeChange={vi.fn()}
        analysisModelId={DEFAULT_ANALYSIS_MODEL_ID}
        onAnalysisModelChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const input = screen.getByTestId('saina-profile-avatar-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('saina-profile-avatar-trigger'));
    expect(clickSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('profile-avatar-viewer')).not.toBeInTheDocument();
  });

  it('reselecting same file after cancel reopens crop editor', async () => {
    render(
      <SainaProfileMenu
        safeOnlyMode={false}
        onSafeOnlyModeChange={vi.fn()}
        analysisModelId={DEFAULT_ANALYSIS_MODEL_ID}
        onAnalysisModelChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    const file = new File(['avatar-b'], 'b.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('saina-profile-avatar-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-editor')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('profile-avatar-crop-editor')).not.toBeInTheDocument();
    });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-editor')).toBeInTheDocument();
    });
  });
});

describe('header avatar size regression', () => {
  it('photo and fallback header avatars are both 44px', () => {
    const css = readCss('styles/saina-mirror.css');
    expect(css).toMatch(/\.saina-profile-avatar--top\s*\{[^}]*width:\s*44px/);
    expect(css).toMatch(/\.saina-profile-avatar--top\s*\{[^}]*height:\s*44px/);
    expect(css).toMatch(
      /\.bilign-profile-avatar--has-photo\.saina-profile-avatar--top\s*\{[^}]*width:\s*44px/
    );
    expect(css).toMatch(
      /\.bilign-profile-avatar--has-photo\.saina-profile-avatar--top\s*\{[^}]*height:\s*44px/
    );
    expect(css).not.toMatch(
      /\.bilign-profile-avatar--has-photo\.saina-profile-avatar--top\s*\{[^}]*--saina-topbar-control-h/
    );
  });
});

describe('320px dialog safety', () => {
  it('crop and viewer dialogs use viewport-aware width and box-sizing', () => {
    const css = readCss('styles/profile-avatar-crop-viewer.css');
    expect(css).toContain('box-sizing: border-box');
    expect(css).toContain('calc(100vw - 1.5rem)');
    expect(css).toContain('aspect-ratio: 1 / 1');
    expect(css).toContain('min(280px, calc(100vw - 3rem))');
  });
});
