import { describe, expect, it, vi } from 'vitest';
import {
  AVATAR_CROP_VIEWPORT_PX,
  clampAvatarCropPan,
  computeAvatarCoverScale,
  computeAvatarCropSourceRect,
  defaultAvatarCropState,
} from '@/lib/eza/profile/avatarCrop';
import {
  avatarCropGesturePointerCancel,
  avatarCropGesturePointerDown,
  avatarCropGesturePointerMove,
  avatarCropGesturePointerUp,
  createAvatarCropGestureState,
} from '@/lib/eza/profile/avatarCropGesture';

const ZOOM_LEVELS = [1, 1.5, 2.75] as const;

const ASPECT_CASES = [
  { label: 'very tall', width: 500, height: 4000 },
  { label: 'very wide', width: 4000, height: 500 },
  { label: 'square', width: 2000, height: 2000 },
  { label: 'portrait', width: 1500, height: 3000 },
  { label: 'landscape', width: 3000, height: 1500 },
] as const;

const BOUNDS_EPSILON = 1e-6;

function assertCropInsideImage(
  imageWidth: number,
  imageHeight: number,
  crop: ReturnType<typeof defaultAvatarCropState>
) {
  const clamped = clampAvatarCropPan(imageWidth, imageHeight, crop);
  const { sx, sy, size } = computeAvatarCropSourceRect(imageWidth, imageHeight, clamped);
  expect(sx).toBeGreaterThanOrEqual(-BOUNDS_EPSILON);
  expect(sy).toBeGreaterThanOrEqual(-BOUNDS_EPSILON);
  expect(sx + size).toBeLessThanOrEqual(imageWidth + BOUNDS_EPSILON);
  expect(sy + size).toBeLessThanOrEqual(imageHeight + BOUNDS_EPSILON);
  expect(size).toBeGreaterThan(0);
}

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

describe('avatarCrop extreme aspect ratios', () => {
  for (const aspect of ASPECT_CASES) {
    for (const zoom of ZOOM_LEVELS) {
      it(`${aspect.label} at zoom ${zoom} never exposes empty source region`, () => {
        assertCropInsideImage(aspect.width, aspect.height, {
          ...defaultAvatarCropState(),
          zoom,
        });
        assertCropInsideImage(aspect.width, aspect.height, {
          zoom,
          offsetX: AVATAR_CROP_VIEWPORT_PX,
          offsetY: -AVATAR_CROP_VIEWPORT_PX,
        });
      });
    }
  }
});

describe('avatarCropGesture state machine', () => {
  const crop = { offsetX: 0, offsetY: 0, zoom: 1.2 };

  it('pointer 1 down enters pan mode', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 100, 100, crop);
    expect(state.mode).toBe('one_pointer_pan');
    expect(state.pan).not.toBeNull();
  });

  it('pointer 2 down suspends pan and enters pinch mode', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 100, 100, crop);
    state = avatarCropGesturePointerDown(state, 2, 200, 100, crop);
    expect(state.mode).toBe('two_pointer_pinch');
    expect(state.pan).toBeNull();
    expect(state.pinch?.zoom).toBe(1.2);
  });

  it('two pointer move changes zoom without pan delta', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 100, 100, crop);
    state = avatarCropGesturePointerDown(state, 2, 200, 100, crop);
    const moved = avatarCropGesturePointerMove(state, 2, 260, 100);
    expect(moved.zoom).toBeDefined();
    expect(moved.offsetX).toBeUndefined();
    expect(moved.state.mode).toBe('two_pointer_pinch');
  });

  it('pointer 2 up ends pinch and clears stale pan', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 100, 100, crop);
    state = avatarCropGesturePointerDown(state, 2, 200, 100, crop);
    state = avatarCropGesturePointerUp(state, 2);
    expect(state.mode).toBe('idle');
    expect(state.pan).toBeNull();
    expect(state.pinch).toBeNull();
  });

  it('remaining pointer after pinch does not continue old pan', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 100, 100, crop);
    state = avatarCropGesturePointerDown(state, 2, 200, 100, crop);
    state = avatarCropGesturePointerUp(state, 2);
    const moved = avatarCropGesturePointerMove(state, 1, 180, 180);
    expect(moved.offsetX).toBeUndefined();
    expect(moved.state.mode).toBe('idle');
  });

  it('fresh one-pointer gesture pans again', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 50, 50, crop);
    state = avatarCropGesturePointerUp(state, 1);
    state = avatarCropGesturePointerDown(state, 3, 80, 80, crop);
    const moved = avatarCropGesturePointerMove(state, 3, 100, 110);
    expect(moved.offsetX).toBe(20);
    expect(moved.offsetY).toBe(30);
  });

  it('pointercancel resets to idle', () => {
    let state = createAvatarCropGestureState();
    state = avatarCropGesturePointerDown(state, 1, 10, 10, crop);
    state = avatarCropGesturePointerCancel(state, 1);
    expect(state.mode).toBe('idle');
    expect(state.pointers.size).toBe(0);
  });
});

describe('releaseOrientedAvatarImage', () => {
  it('closes ImageBitmap when supported', async () => {
    const { releaseOrientedAvatarImage } = await import('@/lib/eza/profile/avatarCrop');
    const close = vi.fn();
    releaseOrientedAvatarImage({
      bitmap: { close } as unknown as ImageBitmap,
      width: 1,
      height: 1,
    });
    expect(close).toHaveBeenCalled();
  });
});

describe('profileAvatarSizes', () => {
  it('documents identity scale tokens', async () => {
    const { PROFILE_AVATAR_SIZE_PX } = await import('@/lib/eza/profile/profileAvatarSizes');
    expect(PROFILE_AVATAR_SIZE_PX.header).toBe(44);
    expect(PROFILE_AVATAR_SIZE_PX.panel).toBe(72);
    expect(PROFILE_AVATAR_SIZE_PX.heroDesktop).toBe(84);
    expect(PROFILE_AVATAR_SIZE_PX.heroMobile).toBe(66);
    expect(PROFILE_AVATAR_SIZE_PX.authorRow).toBe(28);
  });
});
