/**
 * Desktop Reel wheel / trackpad → Discover vertical navigation.
 * Chat must not call this with enabled=true.
 *
 * One intentional gesture commits exactly one direction. Momentum after
 * commit is ignored until the lock expires and the gesture goes idle.
 */

export type YansiWheelDirection = 'up' | 'down';

export type YansiWheelGestureState = {
  accum: number;
  lockedUntil: number;
  lastEventAt: number;
};

/** Absolute deltaY needed to commit one Yansı (px-equivalent). */
export const YANSI_WHEEL_COMMIT_PX = 86;

/** After a commit, ignore further ticks so trackpad inertia cannot skip. */
export const YANSI_WHEEL_LOCK_MS = 640;

/** Gap after which leftover accumulation is treated as a new gesture. */
export const YANSI_WHEEL_IDLE_RESET_MS = 200;

export function createYansiWheelGestureState(): YansiWheelGestureState {
  return { accum: 0, lockedUntil: 0, lastEventAt: 0 };
}

export function resolveYansiWheelTick(
  state: YansiWheelGestureState,
  deltaY: number,
  now: number,
  options?: { enabled?: boolean }
): { state: YansiWheelGestureState; direction: YansiWheelDirection | null } {
  if (options?.enabled === false) {
    return { state: createYansiWheelGestureState(), direction: null };
  }

  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return { state, direction: null };
  }

  if (now < state.lockedUntil) {
    return {
      state: { ...state, lastEventAt: now },
      direction: null,
    };
  }

  const stale = state.lastEventAt > 0 && now - state.lastEventAt > YANSI_WHEEL_IDLE_RESET_MS;
  const accum = (stale ? 0 : state.accum) + deltaY;

  if (accum >= YANSI_WHEEL_COMMIT_PX) {
    return {
      state: {
        accum: 0,
        lockedUntil: now + YANSI_WHEEL_LOCK_MS,
        lastEventAt: now,
      },
      direction: 'down',
    };
  }

  if (accum <= -YANSI_WHEEL_COMMIT_PX) {
    return {
      state: {
        accum: 0,
        lockedUntil: now + YANSI_WHEEL_LOCK_MS,
        lastEventAt: now,
      },
      direction: 'up',
    };
  }

  return {
    state: { accum, lockedUntil: 0, lastEventAt: now },
    direction: null,
  };
}
