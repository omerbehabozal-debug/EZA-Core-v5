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

