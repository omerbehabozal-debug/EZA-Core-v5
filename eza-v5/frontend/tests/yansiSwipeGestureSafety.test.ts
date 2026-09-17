import { describe, expect, it } from 'vitest';
import {
  YANSI_SWIPE_AXIS_DOMINANCE,
  YANSI_SWIPE_HORIZONTAL_COMMIT_PX,
  YANSI_SWIPE_VERTICAL_COMMIT_PX,
  createYansiSwipeGestureState,
  resolveYansiSwipeDirection,
  yansiAtScrollBottom,
  yansiAtScrollTop,
  yansiContentCanScrollVertically,
  yansiSwipePointerDown,
  yansiSwipePointerUp,
  yansiSwipeShouldIgnoreTarget,
  type YansiScrollMetrics,
} from '@/lib/eza/mirror/journey/yansiSwipeGesture';

const longMid: YansiScrollMetrics = {
  scrollTop: 400,
  scrollHeight: 2000,
  clientHeight: 700,
};

const longTop: YansiScrollMetrics = {
  scrollTop: 0,
  scrollHeight: 2000,
  clientHeight: 700,
};

const longBottom: YansiScrollMetrics = {
  scrollTop: 1300,
  scrollHeight: 2000,
  clientHeight: 700,
};

const shortNoScroll: YansiScrollMetrics = {
  scrollTop: 0,
  scrollHeight: 500,
  clientHeight: 700,
};

describe('yansiSwipeGesture scroll arbitration', () => {
  it('exports deliberate thresholds and axis dominance', () => {
    expect(YANSI_SWIPE_VERTICAL_COMMIT_PX).toBe(72);
    expect(YANSI_SWIPE_HORIZONTAL_COMMIT_PX).toBe(64);
    expect(YANSI_SWIPE_AXIS_DOMINANCE).toBe(1.75);
  });

  it('long content middle + upward drag => scroll only (no Discover)', () => {
    expect(resolveYansiSwipeDirection(0, -120, longMid)).toBeNull();
  });

  it('long content middle + downward drag => scroll only (no Discover)', () => {
    expect(resolveYansiSwipeDirection(0, 120, longMid)).toBeNull();
  });

  it('top boundary accidental short drag => no navigation', () => {
    expect(resolveYansiSwipeDirection(0, 40, longTop)).toBeNull();
    expect(resolveYansiSwipeDirection(0, YANSI_SWIPE_VERTICAL_COMMIT_PX - 1, longTop)).toBeNull();
  });

  it('bottom boundary accidental short drag => no navigation', () => {
    expect(resolveYansiSwipeDirection(0, -(YANSI_SWIPE_VERTICAL_COMMIT_PX - 1), longBottom)).toBeNull();
  });

  it('deliberate bottom-boundary swipe up => Discover next (up)', () => {
    expect(yansiAtScrollBottom(longBottom)).toBe(true);
    expect(resolveYansiSwipeDirection(0, -YANSI_SWIPE_VERTICAL_COMMIT_PX, longBottom)).toBe('up');
  });

  it('deliberate top-boundary swipe down => Discover previous (down)', () => {
    expect(yansiAtScrollTop(longTop)).toBe(true);
    expect(resolveYansiSwipeDirection(0, YANSI_SWIPE_VERTICAL_COMMIT_PX, longTop)).toBe('down');
  });

  it('clear horizontal swipe => continuation', () => {
    expect(resolveYansiSwipeDirection(-YANSI_SWIPE_HORIZONTAL_COMMIT_PX, 0, longMid)).toBe('left');
    expect(resolveYansiSwipeDirection(YANSI_SWIPE_HORIZONTAL_COMMIT_PX, 0, longMid)).toBe('right');
  });

  it('diagonal mostly-vertical => never horizontal continuation', () => {
    // 100 vertical, 50 horizontal — ratio 2.0 vertical-ish but check dominance path
    expect(resolveYansiSwipeDirection(50, -100, longBottom)).toBe('up');
    expect(resolveYansiSwipeDirection(50, -100, longBottom)).not.toBe('left');
    expect(resolveYansiSwipeDirection(50, -100, longBottom)).not.toBe('right');
  });

  it('diagonal mostly-horizontal => never Discover navigation', () => {
    expect(resolveYansiSwipeDirection(-100, 40, longBottom)).toBe('left');
    expect(resolveYansiSwipeDirection(-100, 40, longTop)).toBe('left');
    expect(resolveYansiSwipeDirection(-100, 40, longMid)).not.toBe('up');
    expect(resolveYansiSwipeDirection(-100, 40, longMid)).not.toBe('down');
  });

  it('ambiguous diagonal (neither axis dominant) => null', () => {
    expect(resolveYansiSwipeDirection(80, 70, longBottom)).toBeNull();
    expect(resolveYansiSwipeDirection(70, 80, longBottom)).toBeNull();
  });

  it('non-scrollable short content still supports deliberate vertical navigation', () => {
    expect(yansiContentCanScrollVertically(shortNoScroll)).toBe(false);
    expect(resolveYansiSwipeDirection(0, -YANSI_SWIPE_VERTICAL_COMMIT_PX, shortNoScroll)).toBe(
      'up'
    );
    expect(resolveYansiSwipeDirection(0, YANSI_SWIPE_VERTICAL_COMMIT_PX, shortNoScroll)).toBe(
      'down'
    );
  });

  it('pointer up wires scroll metrics into arbitration', () => {
    let state = createYansiSwipeGestureState();
    state = yansiSwipePointerDown(state, 1, 100, 400);
    // Mid-scroll upward — must not navigate
    expect(yansiSwipePointerUp(state, 1, 100, 280, longMid).direction).toBeNull();

    state = yansiSwipePointerDown(createYansiSwipeGestureState(), 2, 100, 400);
    expect(yansiSwipePointerUp(state, 2, 100, 280, longBottom).direction).toBe('up');
  });

  it('ignores interactive chrome targets', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    expect(yansiSwipeShouldIgnoreTarget(btn)).toBe(true);
    expect(yansiSwipeShouldIgnoreTarget(document.createElement('div'))).toBe(false);
    btn.remove();
  });
});
