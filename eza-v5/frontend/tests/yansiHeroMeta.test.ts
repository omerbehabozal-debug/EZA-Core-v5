import { describe, expect, it } from 'vitest';
import { SAINA_NEW_CHAT } from '@/lib/eza/sainaCopy';
import {
  formatYansiHeroMetaTime,
  resolveYansiHeroContentTypeLabel,
  resolveYansiHeroMeta,
  YANSI_HERO_META_TYPE_YANSI,
} from '@/lib/eza/mirror/yansiHeroMeta';

describe('formatYansiHeroMetaTime', () => {
  it('returns compact clock time for today', () => {
    const ref = new Date(2026, 7, 31, 15, 0, 0);
    const savedAt = '2026-08-31T13:00:00';
    const label = formatYansiHeroMetaTime(savedAt, ref);
    expect(label).toMatch(/13:00/);
    expect(label).not.toContain('Bugün');
  });

  it('prefixes yesterday with Dün and time', () => {
    const ref = new Date(2026, 7, 31, 10, 0, 0);
    const savedAt = '2026-08-30T21:08:00';
    expect(formatYansiHeroMetaTime(savedAt, ref)).toMatch(/^Dün 21:08/);
  });

  it('returns Az önce for very recent timestamps', () => {
    const ref = new Date(2026, 7, 31, 14, 40, 0);
    const savedAt = '2026-08-31T14:35:00';
    expect(formatYansiHeroMetaTime(savedAt, ref)).toBe('Az önce');
  });
});

describe('resolveYansiHeroContentTypeLabel', () => {
  it('maps normal chat to Yeni sohbet', () => {
    expect(resolveYansiHeroContentTypeLabel('none')).toBe(SAINA_NEW_CHAT);
    expect(resolveYansiHeroContentTypeLabel('ready')).toBe(SAINA_NEW_CHAT);
    expect(resolveYansiHeroContentTypeLabel(undefined)).toBe(SAINA_NEW_CHAT);
  });

  it('maps published Yansı only when status is published', () => {
    expect(resolveYansiHeroContentTypeLabel('published')).toBe(YANSI_HERO_META_TYPE_YANSI);
  });
});

describe('resolveYansiHeroMeta', () => {
  it('combines authoritative time and type without fabrication', () => {
    const ref = new Date(2026, 7, 31, 15, 0, 0);
    const meta = resolveYansiHeroMeta({
      savedAt: '2026-08-31T13:00:00',
      yansiStatus: 'published',
      referenceDate: ref,
    });
    expect(meta?.timeLabel).toMatch(/13:00/);
    expect(meta?.typeLabel).toBe('Yansı');
  });

  it('returns null when timestamp is invalid', () => {
    expect(resolveYansiHeroMeta({ savedAt: 'not-a-date' })).toBeNull();
  });
});
