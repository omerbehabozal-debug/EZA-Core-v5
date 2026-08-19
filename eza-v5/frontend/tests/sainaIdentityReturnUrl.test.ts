import { describe, expect, it } from 'vitest';
import {
  buildSainaAuthHref,
  buildSainaAuthReturnUrl,
  resolveSafeAuthReturnPath,
} from '@/lib/eza/sainaIdentity';

describe('sainaIdentity return URL helpers', () => {
  it('buildSainaAuthReturnUrl preserves pathname, search, and hash', () => {
    expect(
      buildSainaAuthReturnUrl({
        pathname: '/standalone',
        search: '?chat=abc',
        hash: '#section',
      })
    ).toBe('/standalone?chat=abc#section');
  });

  it('buildSainaAuthReturnUrl normalizes search without leading ?', () => {
    expect(
      buildSainaAuthReturnUrl({
        pathname: '/standalone',
        search: 'chat=abc',
      })
    ).toBe('/standalone?chat=abc');
  });

  it('buildSainaAuthHref encodes full return URL in login link', () => {
    const href = buildSainaAuthHref('/standalone?chat=abc', 'login');
    expect(href).toBe('/platform/login?return=%2Fstandalone%3Fchat%3Dabc');
  });

  it('resolveSafeAuthReturnPath keeps query string on relative paths', () => {
    expect(resolveSafeAuthReturnPath('/standalone?chat=abc')).toBe('/standalone?chat=abc');
  });

  it('rejects protocol-relative URLs', () => {
    expect(resolveSafeAuthReturnPath('//evil.example')).toBe('/standalone/discover');
  });

  it('rejects absolute and backslash return URLs', () => {
    expect(resolveSafeAuthReturnPath('https://evil.example')).toBe('/standalone/discover');
    expect(resolveSafeAuthReturnPath('/\\evil')).toBe('/standalone/discover');
  });

  it('defaults empty auth return path to Keşfet home', () => {
    expect(resolveSafeAuthReturnPath(null)).toBe('/standalone/discover');
    expect(buildSainaAuthReturnUrl({})).toBe('/standalone/discover');
  });
});
