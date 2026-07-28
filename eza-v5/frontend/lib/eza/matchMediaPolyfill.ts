/** Framer Motion still calls deprecated MediaQueryList.addListener on some engines. */
export function ensureMatchMediaListenerPolyfill(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  const mq = window.matchMedia('(max-width: 1px)');
  const proto = Object.getPrototypeOf(mq) as MediaQueryList & {
    addListener?: (listener: () => void) => void;
    removeListener?: (listener: () => void) => void;
  };

  // Never patch Object.prototype (vitest/jsdom often returns a plain mock object).
  if (!proto || proto === Object.prototype || typeof proto.addListener === 'function') return;

  proto.addListener = function addListener(listener: () => void) {
    this.addEventListener('change', listener);
  };
  proto.removeListener = function removeListener(listener: () => void) {
    this.removeEventListener('change', listener);
  };
}

ensureMatchMediaListenerPolyfill();
