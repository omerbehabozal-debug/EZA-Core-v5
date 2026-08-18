/**
 * Prefetch/network download is not Yansı exposure.
 * Qualifying visibility still counts through YansiExposureRoot.
 */

import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import {
  clearYansiExposureForTests,
  trackYansiExposure,
} from '@/lib/eza/mirror-network/yansiExposure';

vi.mock('@/lib/eza/mirror-network/yansiExposure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/mirror-network/yansiExposure')>(
    '@/lib/eza/mirror-network/yansiExposure'
  );
  return {
    ...actual,
    trackYansiExposure: vi.fn(),
  };
});

const trackMock = vi.mocked(trackYansiExposure);

class FakeIntersectionObserver {
  cb: IntersectionObserverCallback;
  static instances: FakeIntersectionObserver[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  trigger(ratio: number) {
    this.cb(
      [
        {
          intersectionRatio: ratio,
          isIntersecting: ratio > 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    );
  }
}

describe('Phase 7.5.1 prefetch is not exposure', () => {
  afterEach(() => {
    clearYansiExposureForTests();
    trackMock.mockReset();
    FakeIntersectionObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it('off-screen prefetched cards do not create exposure', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    render(
      <YansiExposureRoot slug="prefetched-card" journeyVersion={1} context="discover">
        <div>card</div>
      </YansiExposureRoot>
    );
    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeTruthy();
    act(() => observer.trigger(0));
    act(() => observer.trigger(0.2));
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('qualifying visibility still creates exposure', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    render(
      <YansiExposureRoot slug="visible-card" journeyVersion={1} context="discover">
        <div>card</div>
      </YansiExposureRoot>
    );
    const observer = FakeIntersectionObserver.instances[0];
    act(() => observer.trigger(0.6));
    expect(trackMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(trackMock).toHaveBeenCalledWith({
      slug: 'visible-card',
      journeyVersion: 1,
      context: 'discover',
    });
    vi.useRealTimers();
  });
});
