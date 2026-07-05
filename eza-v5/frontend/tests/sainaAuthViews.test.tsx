import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const loginViewSrc = readFileSync(
  join(process.cwd(), 'components/saina/SainaLoginView.tsx'),
  'utf8'
);
const registerViewSrc = readFileSync(
  join(process.cwd(), 'components/saina/SainaRegisterView.tsx'),
  'utf8'
);

describe('SAINA auth views (V1)', () => {
  it('hides Google OAuth button on login', () => {
    expect(loginViewSrc).not.toContain('SainaAuthGoogleButton');
    expect(loginViewSrc).not.toContain('SainaAuthDivider');
  });

  it('hides Google OAuth button on register', () => {
    expect(registerViewSrc).not.toContain('SainaAuthGoogleButton');
    expect(registerViewSrc).not.toContain('SainaAuthDivider');
  });

  it('uses shared auth href builder for cross-links', () => {
    expect(loginViewSrc).toContain('buildSainaAuthHref');
    expect(registerViewSrc).toContain('buildSainaAuthHref');
    expect(loginViewSrc).toContain('resolveSafeAuthReturnPath');
    expect(registerViewSrc).toContain('resolveSafeAuthReturnPath');
  });
});
