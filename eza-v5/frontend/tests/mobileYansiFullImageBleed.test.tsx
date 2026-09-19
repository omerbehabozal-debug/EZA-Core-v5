/**
 * Mobile Yansı — photograph must physically bleed behind Ayna/composer.
 * Clear stage is gradient-defined; paint must not end as a mid-screen panel.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı full image bleed behind bottom chrome', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  const frameRule = mobileBlock.slice(
    mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {'),
    mobileBlock.indexOf(
      '.saina-app-root.saina-standalone-shell .saina-canvas-overlay--center'
    )
  );

  it('sizes the paint frame beyond 100dvh so photo exists under Ayna and composer', () => {
    expect(mobileBlock).toMatch(
      /--saina-mobile-cover-frame-height:\s*110dvh/
    );
    expect(frameRule).toContain('height: var(--saina-mobile-cover-frame-height)');
    expect(frameRule).toContain('min-height: var(--saina-mobile-cover-frame-height)');
    expect(frameRule).toMatch(/top:\s*50%/);
  });

  it('does not use a shortened mid-stage clip that exposes black footer', () => {
    expect(mobileBlock).not.toContain('min(100vw, 54dvh)');
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-center-y');
    expect(frameRule).not.toMatch(/top:\s*var\(--saina-mobile-image-stage/);
  });

  it('keeps scene-fit full-viewport with overscan width under gradients', () => {
    const fitRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit {'),
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {')
    );
    expect(fitRule).toMatch(/inset:\s*0/);
    expect(frameRule).toMatch(/width:\s*112%/);
    expect(frameRule).toMatch(/min-width:\s*112%/);
  });

  it('relies on gradient veils for clear-stage edges; bottom veil sits on fixed chrome', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\.99\)/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*height:\s*36dvh/
    );
    expect(mobileBlock).toMatch(
      /\.saina-mobile-yansi-header::before[\s\S]*height:\s*100%/
    );
  });

  it('leaves composer fixed, Ayna float, title ivory, and desktop free of mobile paint tokens', () => {
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/
    );
    expect(mobileBlock).toContain('.saina-mobile-ayna-float');
    expect(mobileBlock).toMatch(
      /\.saina-hero-title\s*\{[^}]*color:\s*var\(--bilign-text\)/s
    );
    expect(desktopBlock).not.toContain('--saina-mobile-cover-frame-height: 110dvh');
  });
});
