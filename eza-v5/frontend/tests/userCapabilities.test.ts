import { describe, expect, it } from 'vitest';
import {
  BILIGN_PLATFORM_ADMIN_CAPABILITY,
  hasBilignPlatformAdmin,
  normalizeCapabilities,
} from '@/lib/eza/userCapabilities';

describe('userCapabilities', () => {
  it('detects BiligN platform admin from capabilities, not EZA role', () => {
    expect(hasBilignPlatformAdmin({ capabilities: [BILIGN_PLATFORM_ADMIN_CAPABILITY] })).toBe(true);
    expect(hasBilignPlatformAdmin({ capabilities: [] })).toBe(false);
    expect(hasBilignPlatformAdmin({ capabilities: undefined })).toBe(false);
    expect(hasBilignPlatformAdmin(null)).toBe(false);
  });

  it('normalizes capability lists', () => {
    expect(normalizeCapabilities(['bilign.platform_admin', 1, '', ' x '])).toEqual([
      'bilign.platform_admin',
      'x',
    ]);
    expect(normalizeCapabilities(null)).toEqual([]);
  });
});
