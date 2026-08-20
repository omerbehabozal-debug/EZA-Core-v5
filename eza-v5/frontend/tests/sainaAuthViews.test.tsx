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
  it('wires social auth buttons on login (Phase 8.7.1)', () => {
    expect(loginViewSrc).toContain('SainaSocialAuthButtons');
    expect(loginViewSrc).toContain('resolveSafeAuthReturnPath');
  });

  it('wires social auth buttons on register (Phase 8.7.1)', () => {
    expect(registerViewSrc).toContain('SainaSocialAuthButtons');
    expect(registerViewSrc).toContain('resolveSafeAuthReturnPath');
  });

  it('uses shared auth href builder for cross-links', () => {
    expect(loginViewSrc).toContain('buildSainaAuthHref');
    expect(registerViewSrc).toContain('buildSainaAuthHref');
    expect(loginViewSrc).toContain('resolveSafeAuthReturnPath');
    expect(registerViewSrc).toContain('resolveSafeAuthReturnPath');
  });
});
