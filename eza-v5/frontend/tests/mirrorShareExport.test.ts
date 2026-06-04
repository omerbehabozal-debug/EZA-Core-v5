import { describe, it, expect } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  buildMirrorExportFilename,
  getMirrorShareTexts,
  MIRROR_EXPORT_TARGET_HEIGHT,
  MIRROR_EXPORT_TARGET_WIDTH,
  resolveMirrorExportFilename,
  resolveMirrorShareText,
} from '@/lib/eza/mirror/shareExport';

const card: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: '21 Mayıs',
  headline: 'Test',
  characterName: 'Şefkatli Geyik',
  personaFamilyId: 'sensitive_careful',
  shortInsight: 'i',
  userLine: 'u',
  aiLine: 'a',
  balanceLine: 'b',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 70,
  shareEnabled: true,
  privacyText: 'p',
  dailyAvatarName: 'Şefkatli Geyik',
  dailyThemeTitle: 'İlişki & Bağ',
};

describe('mirrorShareExport', () => {
  it('builds dated png filename without card (legacy)', () => {
    expect(buildMirrorExportFilename('2026-05-21T12:00:00.000Z')).toBe(
      'eza-daily-mirror-2026-05-21.png'
    );
  });

  it('identity export filename slugifies Turkish names', () => {
    expect(resolveMirrorExportFilename(card)).toBe(
      'eza-sefkatli-geyik-iliski-bag-2026-05-21.png'
    );
  });

  it('exposes identity share texts without message content', () => {
    const texts = getMirrorShareTexts(card);
    expect(texts.short).toContain('Şefkatli Geyik');
    expect(texts.short).toContain('İlişki & Bağ');
    expect(texts.short).toMatch(/Seninki ne çıkacak/i);
    expect(texts.short).not.toMatch(/userLine|mesaj içeriği:/i);
    expect(resolveMirrorShareText(card)).toBe(texts.short);
    expect(MIRROR_EXPORT_TARGET_WIDTH).toBe(1080);
    expect(MIRROR_EXPORT_TARGET_HEIGHT).toBe(1920);
  });
});
