/**
 * BiligN shared account identity — Business / Admin chrome mirrors AuthContext profile.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveAuthUserDisplayName,
  resolveAuthUserInitial,
  resolveSainaUserDisplayName,
} from '@/lib/eza/sainaIdentity';

describe('BiligN auth identity sync', () => {
  it('prefers public_display_name over stale full_name', () => {
    expect(
      resolveAuthUserDisplayName({
        email: 'a@b.com',
        full_name: 'Eski Ad',
        public_display_name: 'Tarık Ayşe',
      })
    ).toBe('Tarık Ayşe');
    expect(
      resolveSainaUserDisplayName('a@b.com', 'Eski Ad', 'Yeni Ad')
    ).toBe('Yeni Ad');
    expect(
      resolveAuthUserInitial({
        email: 'a@b.com',
        full_name: 'Eski',
        public_display_name: 'Yeni',
      })
    ).toBe('Y');
  });

  it('Business and Platform Admin headers use shared Auth account mark', () => {
    const manager = readFileSync(
      join(process.cwd(), 'components/saina/SainaBusinessManager.tsx'),
      'utf8'
    );
    const gate = readFileSync(
      join(process.cwd(), 'components/saina/SainaBusinessGate.tsx'),
      'utf8'
    );
    const admin = readFileSync(
      join(process.cwd(), 'components/saina/SainaPlatformAdmin.tsx'),
      'utf8'
    );
    const mark = readFileSync(
      join(process.cwd(), 'components/saina/SainaAuthAccountMark.tsx'),
      'utf8'
    );
    for (const src of [manager, gate, admin]) {
      expect(src).toContain('SainaAuthAccountMark');
      expect(src).toContain('resolveAuthUserDisplayName');
    }
    expect(mark).toContain('resolveSelfProfileAvatar');
    expect(mark).toContain('ProfileUserAvatar');
    // Application contact_name must remain independent of profile rename.
    const inbox = readFileSync(
      join(process.cwd(), 'components/saina/SainaBusinessAdminInbox.tsx'),
      'utf8'
    );
    expect(inbox).toContain('contact_name');
    expect(admin).not.toContain('contact_name');
  });

  it('AuthContext syncs profile across tabs and on visibility', () => {
    const auth = readFileSync(join(process.cwd(), 'context/AuthContext.tsx'), 'utf8');
    expect(auth).toContain("addEventListener('storage'");
    expect(auth).toContain('visibilitychange');
    expect(auth).toContain('softRefreshFromServer');
    expect(auth).toContain('USER_STORAGE_KEY');
  });
});
