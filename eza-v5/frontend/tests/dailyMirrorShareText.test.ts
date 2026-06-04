import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  buildDailyMirrorExportFilename,
  buildDailyMirrorShareText,
  slugifyForFilename,
} from '@/lib/eza/mirror/dailyMirrorShareText';
import {
  resolveMirrorExportFilename,
  resolveMirrorShareText,
  shareMirrorCardPng,
} from '@/lib/eza/mirror/shareExport';

const baseCard: DailyMirrorCardModel = {
  date: '2026-06-04',
  dayLabel: '4 Haziran 2026',
  headline: 'Test',
  characterName: 'Yol Bulucu',
  personaFamilyId: 'curiosity_exploration',
  shortInsight: 'Insight',
  userLine: 'x',
  aiLine: 'y',
  balanceLine: 'z',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 72,
  shareEnabled: true,
  privacyText: 'privacy',
  dailyAvatarName: 'Yol Bulucu',
  behaviorFamilyLabel: 'Keşif Ailesi',
  dailyThemeTitle: 'Semerkant Yolculuğu',
};

describe('dailyMirrorShareText (P3)', () => {
  it('buildDailyMirrorShareText includes avatar, theme, and curiosity line', () => {
    const text = buildDailyMirrorShareText(baseCard);
    expect(text).toContain('Yol Bulucu');
    expect(text).toContain('Semerkant Yolculuğu');
    expect(text).toMatch(/Seninki ne çıkacak/i);
    expect(text).toContain('#EZAİlişkiAynası');
    expect(text).toMatch(/Bugün AI ile ilişkim/i);
    expect(text).not.toMatch(/userLine|mesaj içeriği:/i);
  });

  it('fallback share text when identity fields missing', () => {
    const sparse: DailyMirrorCardModel = {
      ...baseCard,
      dailyAvatarName: undefined,
      characterName: '',
      dailyThemeTitle: undefined,
      behaviorFamilyLabel: undefined,
    };
    const text = buildDailyMirrorShareText(sparse);
    expect(text).toMatch(/Bugünkü AI ilişki aynama baktım/i);
    expect(text).toMatch(/Seninki ne çıkacak/i);
    expect(text).toContain('#EZAİlişkiAynası');
  });

  it('slugify converts Turkish characters for filenames', () => {
    expect(slugifyForFilename('Şefkatli Geyik')).toBe('sefkatli-geyik');
    expect(slugifyForFilename('Semerkant Yolculuğu')).toBe('semerkant-yolculugu');
    expect(slugifyForFilename('İlişki & Bağ')).toBe('iliski-bag');
  });

  it('buildDailyMirrorExportFilename uses avatar + theme + date', () => {
    expect(buildDailyMirrorExportFilename(baseCard)).toBe(
      'eza-yol-bulucu-semerkant-yolculugu-2026-06-04.png'
    );
  });

  it('export filename falls back to dated name without identity', () => {
    expect(buildDailyMirrorExportFilename(null, '2026-06-04')).toBe(
      'eza-daily-mirror-2026-06-04.png'
    );
  });

  it('resolveMirrorShareText and resolveMirrorExportFilename wire through shareExport', () => {
    expect(resolveMirrorShareText(baseCard)).toContain('Yol Bulucu');
    expect(resolveMirrorExportFilename(baseCard)).toMatch(/^eza-yol-bulucu-/);
  });
});

describe('shareMirrorCardPng navigator payload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes identity share text to navigator.share', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { share, canShare });

    const blob = new Blob(['png'], { type: 'image/png' });
    const text = buildDailyMirrorShareText(baseCard);
    await shareMirrorCardPng(blob, {
      text,
      filename: buildDailyMirrorExportFilename(baseCard),
    });

    expect(share).toHaveBeenCalled();
    const payload = share.mock.calls[0]?.[0] as { text?: string };
    expect(payload.text).toContain('Yol Bulucu');
    expect(payload.text).toContain('Semerkant Yolculuğu');
    expect(payload.text).toMatch(/Seninki ne çıkacak/i);
  });
});
