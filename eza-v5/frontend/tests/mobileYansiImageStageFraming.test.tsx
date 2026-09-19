/**
 * Mobile Yansı effective image-stage geometry — shorter cover rectangle than 100dvh.
 * Preserves edge gradients / Ayna / keyboard inset; does not touch desktop framing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Mobile Yansı effective image-stage framing', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const scene = read('components/saina/SainaCinematicScene.tsx');
  const mobileBlock = css.slice(
    css.indexOf('@media (max-width: 899px)'),
    css.indexOf('@media (min-width: 900px)')
  );
  const desktopBlock = css.slice(css.indexOf('@media (min-width: 900px)'));

  it('keeps fullscreen shell at 100dvh while scene-fit is no longer inset:0', () => {
    expect(mobileBlock).toMatch(/\.saina-shell[\s\S]*height:\s*100dvh/);
    expect(mobileBlock).toContain('--saina-mobile-image-stage-top');
    expect(mobileBlock).toContain('--saina-mobile-image-stage-bottom');
    const sceneFitRule = mobileBlock.slice(
      mobileBlock.indexOf('.saina-app-root.saina-standalone-shell .saina-scene-fit {'),
      mobileBlock.indexOf(
        '.saina-app-root.saina-standalone-shell .saina-canvas-overlay--center'
      )
    );
    expect(sceneFitRule).toContain('inset: auto');
    expect(sceneFitRule).toContain('--saina-mobile-image-stage-top');
    expect(sceneFitRule).not.toMatch(/inset:\s*0/);
  });

  it('image-stage insets exclude keyboard inset (stable crop when keyboard opens)', () => {
    const stageDecl = mobileBlock.slice(
      mobileBlock.indexOf('--saina-mobile-image-stage-top'),
      mobileBlock.indexOf('.saina-canvas-bg--default-scene')
    );
    expect(stageDecl).not.toContain('--saina-keyboard-inset');
    expect(mobileBlock).toContain('var(--saina-keyboard-inset, 0px)');
  });

  it('preserves cover + focal authority; does not switch to contain', () => {
    expect(mirror).toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*cover/s
    );
    expect(mirror).toContain('--mirror-focal-position');
    expect(scene).toContain('mirrorFocalCssVars');
    expect(mobileBlock).not.toMatch(/background-size:\s*contain/);
    expect(desktopBlock).not.toContain('--saina-mobile-image-stage-top');
  });

  it('keeps edge readability overlays and does not reintroduce center dim', () => {
    expect(mobileBlock).toContain('.saina-mobile-yansi-header::before');
    expect(mobileBlock).toContain('.saina-chat-bottom-anchor::before');
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--center[\s\S]*display:\s*none/
    );
    expect(mobileBlock).toMatch(
      /\.saina-canvas-overlay--pattern-dim[\s\S]*display:\s*none/
    );
    expect(mobileBlock).not.toContain('ellipse 78% 38% at 48% 34%');
  });

  it('bleeds image stage slightly under dark zones for seamless blend', () => {
    expect(mobileBlock).toContain('--saina-mobile-image-stage-bleed');
    expect(mobileBlock).toMatch(
      /top:\s*calc\(var\(--saina-mobile-image-stage-top\) - var\(--saina-mobile-image-stage-bleed\)\)/
    );
    expect(mobileBlock).toMatch(
      /bottom:\s*calc\(var\(--saina-mobile-image-stage-bottom\) - var\(--saina-mobile-image-stage-bleed\)\)/
    );
  });
});
