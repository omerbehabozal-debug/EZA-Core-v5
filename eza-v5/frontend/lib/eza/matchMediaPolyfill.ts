/** Framer Motion still calls deprecated MediaQueryList.addListener on some engines. */
export function ensureMatchMediaListenerPolyfill(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  const mq = window.matchMedia('(max-width: 1px)');
  const proto = Object.getPrototypeOf(mq) as MediaQueryList & {
    addListener?: (listener: () => void) => void;
    removeListener?: (listener: () => void) => void;
  };

  if (!proto || typeof proto.addListener === 'function') return;

  proto.addListener = function addListener(listener: () => void) {
    this.addEventListener('change', listener);
  };
  proto.removeListener = function removeListener(listener: () => void) {
    this.removeEventListener('change', listener);
  };
}

ensureMatchMediaListenerPolyfill();
