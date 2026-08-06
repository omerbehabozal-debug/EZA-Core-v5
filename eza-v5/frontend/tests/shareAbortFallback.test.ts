import { describe, expect, it, vi } from 'vitest';
import { shareMirrorCardPng } from '@/lib/eza/mirror/shareExport';

describe('shareMirrorCardPng abort handling', () => {
  it('returns aborted on AbortError and does not throw', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        share,
        canShare: () => true,
      },
    });

    const blob = new Blob(['x'], { type: 'image/png' });
    await expect(shareMirrorCardPng(blob, { title: 't', text: 'x' })).resolves.toBe('aborted');
  });
});
