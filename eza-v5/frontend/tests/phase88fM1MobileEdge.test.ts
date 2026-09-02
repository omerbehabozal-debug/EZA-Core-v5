import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAINA_MOBILE_MAX_PX, SAINA_COMPACT_SHELL_MIN_PX } from '@/lib/eza/sainaBreakpoints';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Phase 8.8F-M.1 mobile edge-to-edge shell closure', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const publicCss = read('styles/saina-yansi-mobile-public.css');
  const mirror = read('styles/saina-mirror.css');
  const standaloneLayout = read('app/standalone/SainaAppRootLayout.tsx');
  const mirrorLayout = read('app/m/layout.tsx');
  const landing = read('components/mirror-landing/MirrorLandingExperience.tsx');
  const sohbet = read('components/mirror-landing/MirrorSohbetOpening.tsx');

  it('uses deterministic 899/900 breakpoint constants', () => {
    expect(SAINA_MOBILE_MAX_PX).toBe(899);
    expect(SAINA_COMPACT_SHELL_MIN_PX).toBe(900);
    expect(css).toContain('@media (max-width: 899px)');
    expect(css).toContain('@media (min-width: 900px)');
  });

  it('flattens standalone shell frame on mobile, not only on desktop', () => {
    expect(css).toContain('Phase 8.8F-M.1: mobile edge-to-edge biligN scene shell');
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell\.saina-page[\s\S]*padding:\s*0/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-app-frame[\s\S]*border:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-app-frame[\s\S]*border-radius:\s*0/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-app-frame[\s\S]*box-shadow:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-shell[\s\S]*height:\s*100dvh/
    );
  });

  it('does not rely on legacy mirror frame padding on mobile standalone', () => {
    expect(mirror).toMatch(/\.saina-page[\s\S]*padding:\s*0\.625rem/);
    expect(mirror).toMatch(/\.saina-app-frame[\s\S]*border-radius:\s*24px/);
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell\.saina-page[\s\S]*padding:\s*0/
    );
  });

  it('guards long display names on mobile identity', () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-yansi-identity__name[\s\S]*min-width:\s*0/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-yansi-identity__name[\s\S]*overflow-wrap:\s*anywhere/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.bilign-yansi-identity__name[\s\S]*word-break:\s*break-word/
    );
  });

  it('standalone route imports parity stylesheet chain', () => {
    expect(standaloneLayout).toContain("import '@/styles/saina-mirror.css'");
    expect(standaloneLayout).toContain("import '@/styles/saina-yansi-desktop.css'");
    expect(standaloneLayout).toContain('saina-page saina-app-root saina-standalone-shell');
  });

  it('public /m route imports mobile public parity stylesheet', () => {
    expect(mirrorLayout).toContain("import '@/styles/saina-yansi-mobile-public.css'");
    expect(mirrorLayout).toContain('data-mirror-landing-layout');
    expect(publicCss).toContain('[data-mirror-landing-layout]');
    expect(publicCss).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\[data-mirror-landing\][\s\S]*max-width:\s*none/
    );
    expect(publicCss).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\[data-mirror-sohbet\][\s\S]*max-width:\s*none/
    );
  });

  it('public mirror components use 900px breakpoint for column width', () => {
    expect(landing).toContain('max-w-none');
    expect(landing).toContain('min-[900px]:max-w-lg');
    expect(sohbet).toContain('max-w-none');
    expect(sohbet).toContain('min-[900px]:max-w-lg');
  });

  it('desktop shell flattening remains at min-width 900px without regressing mobile', () => {
    expect(css).toMatch(
      /@media \(min-width: 900px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-app-frame[\s\S]*border:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\.saina-app-root\.saina-standalone-shell \.saina-app-frame[\s\S]*border:\s*none/
    );
  });
});
