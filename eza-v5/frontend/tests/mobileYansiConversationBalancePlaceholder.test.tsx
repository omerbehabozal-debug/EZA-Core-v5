/**
 * Mobile Yansı — conversation optical balance + composer placeholder fit.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAINA_COMPOSER_PLACEHOLDER } from '@/lib/eza/sainaCopy';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı conversation balance + composer placeholder', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const composer = read('components/saina/SainaComposer.tsx');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('keeps title under identity; optically centers short chat in the rail', () => {
    expect(mobileBlock).toMatch(/\.saina-main-body[\s\S]*justify-content:\s*flex-start/);
    expect(mobileBlock).toMatch(
      /\.saina-chat-column--mobile-rail[\s\S]*justify-content:\s*safe center/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-column--mobile-rail[\s\S]*flex:\s*1 1 auto/
    );
    // Blind center on main-body would lift long first lines — forbidden.
    expect(mobileBlock).not.toMatch(
      /\.saina-main-body\s*\{[^}]*justify-content:\s*safe center/s
    );
  });

  it('preserves bottom chrome reserve and scroll for long conversation', () => {
    expect(mobileBlock).toMatch(/\.saina-main-body[\s\S]*overflow-y:\s*auto/);
    expect(mobileBlock).toMatch(
      /\.saina-main-body[\s\S]*padding-bottom:\s*var\(--saina-mobile-bottom-chrome-height\)/
    );
    expect(mobileBlock).toContain('--saina-mobile-bottom-chrome-height');
  });

  it('keeps title→conversation breath smaller than identity→title', () => {
    expect(mobileBlock).toContain(
      '--saina-mobile-identity-title-breath: clamp(1.75rem, 4.2dvh, 2.75rem)'
    );
    expect(mobileBlock).toContain(
      '--saina-identity-chat-breath: clamp(0.85rem, 2.4dvh, 1.35rem)'
    );
  });

  it('gives the composer input flex ownership with min-width 0', () => {
    expect(mobileBlock).toMatch(
      /\.saina-composer-input[\s\S]*flex:\s*1 1 auto[\s\S]*min-width:\s*0/
    );
    expect(mobileBlock).toMatch(
      /\.saina-composer-box \.saina-geometric-mark[\s\S]*flex:\s*0 0 auto/
    );
    expect(mobileBlock).toMatch(
      /\.saina-composer-box \.saina-icon-btn--composer[\s\S]*flex:\s*0 0 auto/
    );
    expect(mobileBlock).toMatch(
      /\.saina-composer-box \.saina-send-btn[\s\S]*flex:\s*0 0 auto/
    );
    expect(mirror).toMatch(/\.saina-composer-input\s*\{[^}]*min-width:\s*0/s);
  });

  it('tunes mobile composer gaps and responsive placeholder type without shrinking controls', () => {
    expect(mobileBlock).toMatch(/\.saina-composer-box[\s\S]*gap:\s*0\.5rem/);
    expect(mobileBlock).toMatch(/\.saina-composer-box[\s\S]*padding:\s*0\.55rem 0\.65rem/);
    expect(mobileBlock).toMatch(
      /\.saina-composer-input[\s\S]*font-size:\s*clamp\(0\.8125rem, 2\.4vw, 0\.875rem\)/
    );
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
    expect(composer).toContain('SainaGeometricMark size={20}');
    expect(composer).toContain('<Mic size={16}');
    expect(composer).toContain('<ArrowUp size={18}');
  });

  it('does not regress Ayna, keyboard, title contrast, image framing, or desktop', () => {
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
    expect(mobileBlock).toMatch(
      /\.saina-hero-title\s*\{[^}]*color:\s*var\(--bilign-text\)/s
    );
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-height: 110dvh');
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-width: max(112%, 110dvh)');
    expect(desktopBlock).not.toContain('gap: 0.5rem');
    expect(desktopBlock).not.toContain(
      'font-size: clamp(0.8125rem, 2.4vw, 0.875rem)'
    );
  });
});
