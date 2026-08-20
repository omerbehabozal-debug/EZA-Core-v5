/**
 * Phase 8.5 — public profile & identity privacy (frontend).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveAuthorDisplayName } from '@/lib/eza/mirror/journey/aynaAuthorDisplay';
import {
  resolveSainaUserDisplayName,
  resolveSainaUserInitial,
} from '@/lib/eza/sainaIdentity';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';

describe('Phase 8.5 public identity privacy', () => {
  it('1–2. email local-part is never public display fallback', () => {
    expect(
      resolveAuthorDisplayName({
        email: 'omerbozal@gmail.com',
        userId: 'u1',
      })
    ).toBe(PUBLIC_DISPLAY_NAME_FALLBACK);
    expect(
      resolveAuthorDisplayName({
        email: 'john.smith@gmail.com',
      })
    ).toBe(PUBLIC_DISPLAY_NAME_FALLBACK);
    expect(resolveSainaUserDisplayName('omerbozal@gmail.com')).toBe('Hesabım');
    expect(resolveSainaUserDisplayName(null)).toBe('Misafir');
  });

  it('3. explicit display name appears', () => {
    expect(
      resolveAuthorDisplayName({
        publicDisplayName: 'Ayşe',
        email: 'omerbozal@gmail.com',
      })
    ).toBe('Ayşe');
    expect(
      resolveSainaUserDisplayName('a@b.com', undefined, 'Meraklı')
    ).toBe('Meraklı');
  });

  it('7–8. unicode / html safety via react text path (no dangerouslySetInnerHTML)', () => {
    expect(resolveAuthorDisplayName({ publicDisplayName: 'محمد · 日本' })).toBe(
      'محمد · 日本'
    );
    expect(
      resolveAuthorDisplayName({ publicDisplayName: '<script>x</script>' })
    ).toBe('<script>x</script>');
    const profile = readFileSync(
      join(process.cwd(), 'components/mirror/ayna/AuthorPublishedYansiProfile.tsx'),
      'utf8'
    );
    expect(profile).not.toContain('dangerouslySetInnerHTML');
  });

  it('14–20. public fetch helpers / DTOs scrub private fields', () => {
    const fetchAuthor = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchAuthorPublished.ts'),
      'utf8'
    );
    expect(fetchAuthor).not.toMatch(/email/i);
    expect(fetchAuthor).toContain('displayName');
    expect(fetchAuthor).not.toContain('lineageProof');
    expect(fetchAuthor).not.toContain('ezaScore');

    const publicMirror = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/fetchPublicMirror.ts'),
      'utf8'
    );
    expect(publicMirror.toLowerCase()).not.toContain('author.email');
    expect(publicMirror).not.toContain('creator.email');

    const landingSurface = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/landingSurface.ts'),
      'utf8'
    );
    expect(landingSurface).not.toMatch(/email/i);
  });

  it('22. profile URL uses opaque uuid path, not email', () => {
    const path = authorProfilePath('550e8400-e29b-41d4-a716-446655440000');
    expect(path).toBe('/standalone/u/550e8400-e29b-41d4-a716-446655440000');
    expect(path).not.toContain('@');
    expect(path).not.toContain('omerbozal');
  });

  it('24. shared-device isolation markers remain in auth/local identity', () => {
    const auth = readFileSync(
      join(process.cwd(), 'context/AuthContext.tsx'),
      'utf8'
    );
    expect(auth).toContain('rotateMirrorGuestToken');
    expect(auth).toContain('public_display_name');
    const localScope = readFileSync(
      join(process.cwd(), 'lib/eza/localIdentityScope.ts'),
      'utf8'
    );
    expect(localScope).toMatch(/user:|guest:/);
  });

  it('27. share metadata page has no email-derived creator', () => {
    const page = readFileSync(join(process.cwd(), 'app/m/[slug]/page.tsx'), 'utf8');
    expect(page).not.toMatch(/email/i);
    expect(page).not.toContain('split("@")');
  });

  it('backend author_profile no longer derives from email local-part', () => {
    const backend = readFileSync(
      join(
        process.cwd(),
        '../backend/services/mirror_network/author_profile.py'
      ),
      'utf8'
    );
    expect(backend).toContain('resolve_public_display_name');
    expect(backend).not.toContain('split("@")');
    expect(backend).toContain('Phase 8.5');
  });

  it('initial does not use email local-part', () => {
    expect(resolveSainaUserInitial('omerbozal@gmail.com')).toBe('·');
    expect(resolveSainaUserInitial('a@b.com', 'Zeynep')).toBe('Z');
  });
});
