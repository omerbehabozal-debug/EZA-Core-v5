import { describe, it, expect } from 'vitest';
import {
  buildMirrorExportFilename,
  getMirrorShareTexts,
  MIRROR_EXPORT_TARGET_HEIGHT,
  MIRROR_EXPORT_TARGET_WIDTH,
} from '@/lib/eza/mirror/shareExport';

describe('mirrorShareExport', () => {
  it('builds dated png filename', () => {
    expect(buildMirrorExportFilename('2026-05-21T12:00:00.000Z')).toBe('eza-mirror-2026-05-21.png');
  });

  it('exposes share texts without message content', () => {
    const texts = getMirrorShareTexts();
    expect(texts.short).toMatch(/EZA Mirror/i);
    expect(texts.short).not.toMatch(/userLine|mesaj içeriği:/i);
    expect(MIRROR_EXPORT_TARGET_WIDTH).toBe(1080);
    expect(MIRROR_EXPORT_TARGET_HEIGHT).toBe(1920);
  });
});
