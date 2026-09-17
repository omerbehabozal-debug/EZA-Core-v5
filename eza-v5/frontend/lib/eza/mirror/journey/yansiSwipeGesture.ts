/**
 * Pointer swipe classifier for public /m navigation.
 * Vertical → Discover; horizontal → continuation.
 *
 * Content scroll has priority: vertical Discover navigation only commits at
 * the relevant scroll boundary after a deliberate threshold + axis dominance.
 * Does not call preventDefault — native vertical scrolling stays intact.
 */

export type YansiSwipeDirection = 'up' | 'down' | 'left' | 'right';

export type YansiSwipeGestureState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  armed: boolean;
};

export type YansiScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/** Deliberate vertical Discover threshold (px). */
export const YANSI_SWIPE_VERTICAL_COMMIT_PX = 72;

/** Deliberate horizontal continuation threshold (px). */
export const YANSI_SWIPE_HORIZONTAL_COMMIT_PX = 64;

/**
 * Dominant axis must exceed the secondary by this ratio.
 * Blocks diagonal accidents (mostly-vertical ≠ continuation, etc.).
 */
export const YANSI_SWIPE_AXIS_DOMINANCE = 1.75;

/** Scroll-edge slop so sub-pixel / rubber-band noise does not block nav. */
export const YANSI_SWIPE_EDGE_SLOP_PX = 4;

export function createYansiSwipeGestureState(): YansiSwipeGestureState {
  return { pointerId: null, startX: 0, startY: 0, armed: false };
}

export function readYansiScrollMetrics(
  el: HTMLElement | null | undefined
): YansiScrollMetrics | null {
  if (!el) return null;
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
}

export function yansiContentCanScrollVertically(m: YansiScrollMetrics): boolean {
  return m.scrollHeight > m.clientHeight + YANSI_SWIPE_EDGE_SLOP_PX;
}

export function yansiAtScrollTop(m: YansiScrollMetrics): boolean {
  return m.scrollTop <= YANSI_SWIPE_EDGE_SLOP_PX;
}

export function yansiAtScrollBottom(m: YansiScrollMetrics): boolean {
  return m.scrollTop + m.clientHeight >= m.scrollHeight - YANSI_SWIPE_EDGE_SLOP_PX;
}

/**
 * Pure arbitration:
 * - clear vertical dominance + at scroll edge in gesture direction → Discover
 * - clear horizontal dominance → continuation
 * - otherwise → null (scroll / ignore)
 *
 * Finger up (dy < 0) scrolls content down; Discover-next only at bottom edge.
 * Finger down (dy > 0) scrolls content up; Discover-prev only at top edge.
 */
export function resolveYansiSwipeDirection(
  dx: number,
  dy: number,
  scroll: YansiScrollMetrics | null
): YansiSwipeDirection | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  const verticalDominant =
    absY >= absX * YANSI_SWIPE_AXIS_DOMINANCE &&
    absY >= YANSI_SWIPE_VERTICAL_COMMIT_PX;
  const horizontalDominant =
    absX >= absY * YANSI_SWIPE_AXIS_DOMINANCE &&
    absX >= YANSI_SWIPE_HORIZONTAL_COMMIT_PX;

  if (verticalDominant && !horizontalDominant) {
    if (dy < 0) {
      // Swipe up → Discover next (goDown)
      if (
        scroll &&
        yansiContentCanScrollVertically(scroll) &&
        !yansiAtScrollBottom(scroll)
      ) {
        return null;
      }
      return 'up';
    }
    // Swipe down → Discover previous (goUp)
    if (
      scroll &&
      yansiContentCanScrollVertically(scroll) &&
      !yansiAtScrollTop(scroll)
    ) {
      return null;
    }
    return 'down';
  }

  if (horizontalDominant && !verticalDominant) {
    return dx < 0 ? 'left' : 'right';
  }

  return null;
}

export function yansiSwipePointerDown(
  state: YansiSwipeGestureState,
  pointerId: number,
  x: number,
  y: number
): YansiSwipeGestureState {
  return { pointerId, startX: x, startY: y, armed: true };
}

export function yansiSwipePointerUp(
  state: YansiSwipeGestureState,
  pointerId: number,
  x: number,
  y: number,
  scroll: YansiScrollMetrics | null = null
): { state: YansiSwipeGestureState; direction: YansiSwipeDirection | null } {
  if (!state.armed || state.pointerId !== pointerId) {
    return { state: createYansiSwipeGestureState(), direction: null };
  }
  const dx = x - state.startX;
  const dy = y - state.startY;
  return {
    state: createYansiSwipeGestureState(),
    direction: resolveYansiSwipeDirection(dx, dy, scroll),
  };
}

export function yansiSwipePointerCancel(
  state: YansiSwipeGestureState,
  pointerId: number
): YansiSwipeGestureState {
  if (state.pointerId !== pointerId) return state;
  return createYansiSwipeGestureState();
}

/** Ignore swipe arm when the gesture starts on interactive chrome. */
export function yansiSwipeShouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [role="button"], [data-yansi-no-swipe]'
    )
  );
}
