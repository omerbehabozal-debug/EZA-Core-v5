/**
 * Pointer gesture state machine for avatar crop viewport.
 * IDLE | ONE_POINTER_PAN | TWO_POINTER_PINCH
 */

export type GestureMode = 'idle' | 'one_pointer_pan' | 'two_pointer_pinch';

export type GesturePointer = { x: number; y: number };

export type PanGesture = {
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
};

export type PinchGesture = {
  distance: number;
  zoom: number;
};

export type AvatarCropGestureState = {
  mode: GestureMode;
  pointers: Map<number, GesturePointer>;
  pan: PanGesture | null;
  pinch: PinchGesture | null;
};

export function createAvatarCropGestureState(): AvatarCropGestureState {
  return { mode: 'idle', pointers: new Map(), pan: null, pinch: null };
}

function pinchDistance(pointers: Map<number, GesturePointer>): number {
  const pts = Array.from(pointers.values());
  if (pts.length < 2) return 0;
  const [a, b] = pts;
  return Math.hypot(a!.x - b!.x, a!.y - b!.y);
}

export function avatarCropGesturePointerDown(
  state: AvatarCropGestureState,
  pointerId: number,
  x: number,
  y: number,
  crop: { offsetX: number; offsetY: number; zoom: number }
): AvatarCropGestureState {
  const pointers = new Map(state.pointers);
  pointers.set(pointerId, { x, y });

  if (pointers.size >= 2) {
    return {
      mode: 'two_pointer_pinch',
      pointers,
      pan: null,
      pinch: { distance: pinchDistance(pointers), zoom: crop.zoom },
    };
  }

  if (pointers.size === 1) {
    return {
      mode: 'one_pointer_pan',
      pointers,
      pan: {
        originX: x,
        originY: y,
        offsetX: crop.offsetX,
        offsetY: crop.offsetY,
      },
      pinch: null,
    };
  }

  return { ...state, pointers };
}

export type AvatarCropGestureMoveResult = {
  state: AvatarCropGestureState;
  offsetX?: number;
  offsetY?: number;
  zoom?: number;
};

export function avatarCropGesturePointerMove(
  state: AvatarCropGestureState,
  pointerId: number,
  x: number,
  y: number
): AvatarCropGestureMoveResult {
  if (!state.pointers.has(pointerId)) {
    return { state };
  }

  const pointers = new Map(state.pointers);
  pointers.set(pointerId, { x, y });

  if (state.mode === 'two_pointer_pinch' && state.pinch && pointers.size >= 2) {
    const distance = pinchDistance(pointers);
    const ratio = state.pinch.distance > 0 ? distance / state.pinch.distance : 1;
    return {
      state: { ...state, pointers },
      zoom: state.pinch.zoom * ratio,
    };
  }

  if (state.mode === 'one_pointer_pan' && state.pan && pointers.size === 1) {
    const dx = x - state.pan.originX;
    const dy = y - state.pan.originY;
    return {
      state: { ...state, pointers },
      offsetX: state.pan.offsetX + dx,
      offsetY: state.pan.offsetY + dy,
    };
  }

  return { state: { ...state, pointers } };
}

export function avatarCropGesturePointerUp(
  state: AvatarCropGestureState,
  pointerId: number
): AvatarCropGestureState {
  const pointers = new Map(state.pointers);
  pointers.delete(pointerId);

  if (state.mode === 'two_pointer_pinch') {
    return { mode: 'idle', pointers, pan: null, pinch: null };
  }

  if (pointers.size === 0) {
    return { mode: 'idle', pointers, pan: null, pinch: null };
  }

  if (state.mode === 'one_pointer_pan') {
    return { mode: 'idle', pointers, pan: null, pinch: null };
  }

  return { ...state, pointers, pan: null, pinch: null };
}

export function avatarCropGesturePointerCancel(
  state: AvatarCropGestureState,
  pointerId: number
): AvatarCropGestureState {
  return avatarCropGesturePointerUp(state, pointerId);
}
