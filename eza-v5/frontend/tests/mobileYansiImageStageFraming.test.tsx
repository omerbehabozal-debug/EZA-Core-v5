/**
 * Mobile Yansı framing vs paint — shorter cover frame, full-bleed scene, long gradients.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı cinematic framing + bleed', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const scene = read('components/saina/SainaCinematicScene.tsx');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('keeps fullscreen shell at 100dvh', () => {
    expect(mobileBlock).toMatch(/\.saina-shell[\s\S]*height:\s*100dvh/);
  });

  it('uses a shorter virtual cover frame, not full-portrait inset crop', () => {
    expect(mobileBlock).toContain('--saina-mobile-cover-frame-height: 70dvh');
    const frameRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {'),
      mobileBlock.indexOf(
        '.saina-app-root.saina-standalone-shell .saina-canvas-overlay--center'
      )
    );
    expect(frameRule).toContain('var(--saina-mobile-cover-frame-height)');
    expect(frameRule).toContain('aspect-ratio: auto !important');
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-top');
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-bottom');
  });

  it('keeps scene-fit full-bleed so the image is not hard-clipped into a photo box', () => {
    const fitRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit {'),
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit__frame {')
    );
    expect(fitRule).toMatch(/inset:\s*0/);
    expect(fitRule).not.toMatch(/inset:\s*auto/);
    expect(fitRule).toContain('overflow: hidden');
  });

  it('extends top and bottom cinematic gradients across ~28–30dvh', () => {
    expect(mobileBlock).toMatch(
      /\.saina-mobile-yansi-header::before[\s\S]*height:\s*30dvh/
    );
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor::before[\s\S]*height:\s*30dvh/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-vignette--scene[\s\S]*rgba\(9, 11, 11, 0\.96\) 0%[\s\S]*rgba\(9, 11, 11, 0\) 30%[\s\S]*rgba\(9, 11, 11, 0\) 70%/
    );
  });

  it('does not create a flat black bottom gap via short stage insets', () => {
    expect(mobileBlock).not.toContain('--saina-mobile-image-stage-bleed');
    expect(mobileBlock).toMatch(
      /\.saina-chat-bottom-anchor[\s\S]*background:\s*transparent/
    );
  });

  it('preserves cover + focal; keyboard inset does not drive frame height', () => {
    expect(mirror).toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*cover/s
    );
    expect(mirror).toContain('--mirror-focal-position');
    expect(scene).toContain('mirrorFocalCssVars');
    expect(mobileBlock).not.toMatch(/background-size:\s*contain/);
    const frameVars = mobileBlock.slice(
      mobileBlock.indexOf('--saina-mobile-cover-frame-height'),
      mobileBlock.indexOf('.saina-canvas-bg--default-scene')
    );
    expect(frameVars).not.toContain('--saina-keyboard-inset');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });

  it('keeps center free of radial/pattern dim and leaves desktop untouched', () => {
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--center[\s\S]*display:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--pattern-dim[\s\S]*display:\s*none/
    );
    expect(mobileBlock).not.toContain('ellipse 78% 38% at 48% 34%');
    expect(desktopBlock).not.toContain('--saina-mobile-cover-frame-height');
  });
});
