import { describe, expect, it } from 'vitest';
import {
  YANSI_WHEEL_COMMIT_PX,
  YANSI_WHEEL_IDLE_RESET_MS,
  YANSI_WHEEL_LOCK_MS,
  createYansiWheelGestureState,
  resolveYansiWheelTick,
} from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';

describe('yansiDesktopWheelGesture', () => {
  it('commits exactly one goDown when threshold is crossed', () => {
    let state = createYansiWheelGestureState();
    const first = resolveYansiWheelTick(state, YANSI_WHEEL_COMMIT_PX - 10, 1_000);
    expect(first.direction).toBeNull();
    const second = resolveYansiWheelTick(first.state, 20, 1_040);
    expect(second.direction).toBe('down');
    state = second.state;
    const burst = resolveYansiWheelTick(state, 400, 1_050);
    expect(burst.direction).toBeNull();
  });

  it('commits exactly one goUp for negative delta', () => {
    const resolved = resolveYansiWheelTick(
      createYansiWheelGestureState(),
      -YANSI_WHEEL_COMMIT_PX,
      2_000
    );
    expect(resolved.direction).toBe('up');
  });

  it('ignores momentum while locked so multiple Yansıs cannot skip', () => {
    const committed = resolveYansiWheelTick(
      createYansiWheelGestureState(),
      YANSI_WHEEL_COMMIT_PX,
      3_000
    );
    expect(committed.direction).toBe('down');
    const lockedA = resolveYansiWheelTick(committed.state, 240, 3_000 + 20);
    const lockedB = resolveYansiWheelTick(lockedA.state, 240, 3_000 + 80);
    const lockedC = resolveYansiWheelTick(lockedB.state, 240, 3_000 + YANSI_WHEEL_LOCK_MS - 1);
    expect(lockedA.direction).toBeNull();
    expect(lockedB.direction).toBeNull();
    expect(lockedC.direction).toBeNull();
  });

  it('disables navigation entirely in chat (enabled=false)', () => {
    const resolved = resolveYansiWheelTick(
      createYansiWheelGestureState(),
      800,
      4_000,
      { enabled: false }
    );
    expect(resolved.direction).toBeNull();
    expect(resolved.state.accum).toBe(0);
  });

  it('resets leftover accumulation after idle gap', () => {
    const partial = resolveYansiWheelTick(
      createYansiWheelGestureState(),
      YANSI_WHEEL_COMMIT_PX - 5,
      5_000
    );
    expect(partial.direction).toBeNull();
    const later = resolveYansiWheelTick(
      partial.state,
      20,
      5_000 + YANSI_WHEEL_IDLE_RESET_MS + 10
    );
    expect(later.direction).toBeNull();
    expect(later.state.accum).toBe(20);
  });
});
