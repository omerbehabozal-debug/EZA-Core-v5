/**
 * Avatar crop / viewer flow — state machine and interaction semantics.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileAvatarCropEditor from '@/components/mirror/ayna/ProfileAvatarCropEditor';
import ProfileAvatarViewer from '@/components/mirror/ayna/ProfileAvatarViewer';

const cropMocks = vi.hoisted(() => ({
  loadOrientedAvatarImage: vi.fn(),
  createOrientedAvatarPreviewUrl: vi.fn(),
  renderAvatarCropToFile: vi.fn(),
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
  };
});

describe('ProfileAvatarCropEditor', () => {
  beforeEach(() => {
    cropMocks.loadOrientedAvatarImage.mockReset();
    cropMocks.createOrientedAvatarPreviewUrl.mockReset();
    cropMocks.renderAvatarCropToFile.mockReset();
    cropMocks.loadOrientedAvatarImage.mockResolvedValue({
      bitmap: {} as ImageBitmap,
      width: 800,
      height: 1200,
    });
    cropMocks.createOrientedAvatarPreviewUrl.mockResolvedValue('blob:oriented-preview');
    cropMocks.renderAvatarCropToFile.mockResolvedValue(
      new File(['out'], 'out.jpg', { type: 'image/jpeg' })
    );
  });

  it('opens after file selection without calling onApply immediately', async () => {
    const onApply = vi.fn();
    const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' });
    render(
      <ProfileAvatarCropEditor file={file} open onCancel={vi.fn()} onApply={onApply} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-editor')).toBeInTheDocument();
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('apply emits cropped file without implying save', async () => {
    const onApply = vi.fn();
    const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' });
    render(
      <ProfileAvatarCropEditor file={file} open onCancel={vi.fn()} onApply={onApply} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-apply')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-apply'));
    await waitFor(() => {
      expect(cropMocks.renderAvatarCropToFile).toHaveBeenCalled();
      expect(onApply).toHaveBeenCalled();
    });
  });

  it('cancel does not apply crop', async () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' });
    render(
      <ProfileAvatarCropEditor file={file} open onCancel={onCancel} onApply={onApply} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-crop-cancel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('profile-avatar-crop-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('zoom slider changes crop state', async () => {
    const file = new File(['x'], 'portrait.jpg', { type: 'image/jpeg' });
    render(
      <ProfileAvatarCropEditor file={file} open onCancel={vi.fn()} onApply={vi.fn()} />
    );
    const slider = await screen.findByTestId('profile-avatar-crop-zoom');
    fireEvent.change(slider, { target: { value: '1.5' } });
    expect((slider as HTMLInputElement).value).toBe('1.5');
  });
});

describe('ProfileAvatarViewer', () => {
  it('opens and closes with escape', async () => {
    const onClose = vi.fn();
    render(
      <ProfileAvatarViewer
        open
        displayName="Ada"
        avatarUrl="/api/public/profile-avatars/u.jpg"
        cacheBust={4}
        onClose={onClose}
      />
    );
    expect(screen.getByTestId('profile-avatar-viewer')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(
      <ProfileAvatarViewer
        open
        displayName="Ada"
        avatarUrl="/api/public/profile-avatars/u.jpg"
        onClose={onClose}
      />
    );
    fireEvent.mouseDown(screen.getByTestId('profile-avatar-viewer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
