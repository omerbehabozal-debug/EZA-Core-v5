import { describe, expect, it } from 'vitest';
import {
  AVATAR_CROP_VIEWPORT_PX,
  clampAvatarCropPan,
  computeAvatarCoverScale,
  computeAvatarCropSourceRect,
  defaultAvatarCropState,
} from '@/lib/eza/profile/avatarCrop';

describe('avatarCrop math', () => {
  it('cover scale fills crop viewport', () => {
    expect(computeAvatarCoverScale(400, 800, AVATAR_CROP_VIEWPORT_PX)).toBeCloseTo(
      AVATAR_CROP_VIEWPORT_PX / 400,
      5
    );
  });

  it('pan changes source rect', () => {
    const base = computeAvatarCropSourceRect(600, 900, defaultAvatarCropState());
    const moved = computeAvatarCropSourceRect(600, 900, {
      ...defaultAvatarCropState(),
      offsetY: -40,
    });
    expect(moved.sy).not.toBe(base.sy);
  });

  it('zoom changes source rect size', () => {
    const base = computeAvatarCropSourceRect(600, 900, defaultAvatarCropState());
    const zoomed = computeAvatarCropSourceRect(600, 900, {
      ...defaultAvatarCropState(),
      zoom: 1.5,
    });
    expect(zoomed.size).toBeLessThan(base.size);
  });

  it('clamp keeps source rect inside image', () => {
    const clamped = clampAvatarCropPan(600, 900, {
      zoom: 2,
      offsetX: 500,
      offsetY: -500,
    });
    const { sx, sy, size } = computeAvatarCropSourceRect(600, 900, clamped);
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(sx + size).toBeLessThanOrEqual(600);
    expect(sy + size).toBeLessThanOrEqual(900);
  });
});

describe('profileAvatarSizes', () => {
  it('documents identity scale tokens', async () => {
    const { PROFILE_AVATAR_SIZE_PX } = await import('@/lib/eza/profile/profileAvatarSizes');
    expect(PROFILE_AVATAR_SIZE_PX.header).toBe(44);
    expect(PROFILE_AVATAR_SIZE_PX.panel).toBe(72);
    expect(PROFILE_AVATAR_SIZE_PX.heroDesktop).toBe(84);
    expect(PROFILE_AVATAR_SIZE_PX.heroMobile).toBe(66);
  });
});
