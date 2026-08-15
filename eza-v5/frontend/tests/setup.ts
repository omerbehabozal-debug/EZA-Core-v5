/**
 * Vitest setup file
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => {
    const listeners = new Set<() => void>();
    const mediaQuery = {
      matches: true,
      media: query,
      onchange: null as (() => void) | null,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_event: string, listener: () => void) => {
        listeners.delete(listener);
      }),
      addListener: vi.fn((listener: () => void) => {
        listeners.add(listener);
      }),
      removeListener: vi.fn((listener: () => void) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    };
    return mediaQuery;
  }),
});

const localStore = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStore.set(key, value);
    },
    removeItem: (key: string) => {
      localStore.delete(key);
    },
    clear: () => {
      localStore.clear();
    },
    get length() {
      return localStore.size;
    },
    key: (index: number) => Array.from(localStore.keys())[index] ?? null,
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => localStore.get(`ss:${key}`) ?? null,
    setItem: (key: string, value: string) => {
      localStore.set(`ss:${key}`, value);
    },
    removeItem: (key: string) => {
      localStore.delete(`ss:${key}`);
    },
    clear: () => {
      Array.from(localStore.keys())
        .filter((k) => k.startsWith('ss:'))
        .forEach((k) => localStore.delete(k));
    },
    get length() {
      return Array.from(localStore.keys()).filter((k) => k.startsWith('ss:')).length;
    },
    key: (index: number) =>
      Array.from(localStore.keys()).filter((k) => k.startsWith('ss:'))[index]?.slice(3) ??
      null,
  },
  writable: true,
});
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : String(input);
          if (url.includes('/experience-events') || url.includes('/exposure-events')) {
    return Promise.resolve(
      new Response(JSON.stringify({ accepted: true, duplicate: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
  if (url.includes('/metrics')) {
    const slugMatch = url.match(/mirror-network\/([^/?]+)\/metrics/i);
    const slug = decodeURIComponent(slugMatch?.[1] || 'unknown').toLowerCase();
    let version = 1;
    try {
      const parsed = new URL(url, 'http://local.test');
      const q = parsed.searchParams.get('journeyVersion');
      if (q) version = Number(q) || 1;
    } catch {
      /* keep 1 */
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          slug,
          journeyVersion: version,
          experienceStartedCount: 0,
          experienceCompletedCount: 0,
          experienceSkippedSessionCount: 0,
          completionRate: null,
          skipRate: null,
          observedAverageDepth: null,
          directChildYansiCount: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  if (typeof originalFetch === 'function') {
    return originalFetch(input, init);
  }
  return Promise.reject(new Error(`fetch not mocked: ${url}`));
};

