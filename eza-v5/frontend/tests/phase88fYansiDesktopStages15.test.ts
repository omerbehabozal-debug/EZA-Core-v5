/**
 * Phase 8.8F Stage 1–5 — scoped desktop Yansı visual styles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAINA_COMPOSER_PLACEHOLDER } from '@/lib/eza/sainaCopy';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.8F Stage 1–5 desktop Yansı styles', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const layout = read('app/standalone/SainaAppRootLayout.tsx');

  it('imports scoped desktop stylesheet from app root layout', () => {
    expect(layout).toContain("import '@/styles/saina-yansi-desktop.css'");
  });

  it('scopes rules to standalone-shell and leaves Discover class unused', () => {
    expect(css).toContain('.saina-app-root.saina-standalone-shell');
    expect(css).not.toContain('.saina-discover-shell');
    expect(css).toContain('@media (min-width: 900px)');
  });

  it('defines Stage 1 fullscreen shell tokens and edge-to-edge frame', () => {
    expect(css).toContain('--bilign-bg: #090b0b');
    expect(css).toContain('--bilign-bronze: #b78949');
    expect(css).toContain('padding: 0');
    expect(css).toContain('border-radius: 0');
    expect(css).toContain('--saina-sidebar-width: 280px');
  });

  it('defines Stage 2 selected conversation left bronze line without pill fill', () => {
    expect(css).toContain('rgba(232, 226, 215, 0.045)');
    expect(css).toContain('2px solid var(--bilign-select-line)');
    expect(css).toContain('--bilign-sidebar-upper: #121414');
    expect(css).toContain('--bilign-sidebar: #101212');
    expect(css).toContain('--bilign-sidebar-lower: #0c0e0e');
  });

  it('defines Stage 3 image normalization and keeps focal CSS var path untouched in scene CSS', () => {
    expect(css).toContain('saturate(0.9)');
    expect(css).toContain('contrast(0.97)');
    expect(css).toContain('brightness(0.94)');
    const scene = read('styles/saina-mirror.css');
    expect(scene).toContain('--mirror-focal-position');
  });

  it('defines Stage 4 editorial reading-plane measure and in-zone scroll height', () => {
    expect(css).toContain('clamp(340px, 46vh, 540px)');
    expect(css).toContain('min(640px, 100%)');
    expect(css).toContain('blur(20px) saturate(70%)');
    expect(css).toContain('mask-composite: intersect');
  });

  it('defines Stage 5 continuation composer glass and muted bronze send', () => {
    expect(css).toContain('min-height: 68px');
    expect(css).toContain('border-radius: 18px');
    expect(css).toContain('blur(22px) saturate(70%)');
  });

  it('updates composer placeholder copy', () => {
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
  });

  it('documents Stage 6–8 identity + rail selectors', () => {
    expect(css).toContain('bilign-yansi-identity');
    expect(css).toContain('bilign-context-rail');
    expect(css).toContain('max-width: 1099px');
  });

  it('tightens empty-state stack and mutes leftover gold chrome', () => {
    expect(css).toContain('saina-main-body--empty');
    expect(css).toContain('saina-chat-column--empty');
    expect(css).toContain('flex-direction: row');
    expect(css).toContain('background: transparent');
  });

  it('restyles desktop Ayna panel chrome without inventing Journey UX', () => {
    expect(css).toContain('saina-mirror-panel');
    expect(css).toContain('--saina-mirror-col-width: 360px');
    expect(css).toContain('saina-mirror-collapse-btn');
    expect(css).toContain('ayna-journey-slide__title');
    expect(css).not.toContain('bilign-progress');
  });
});

describe('Phase 8.8F Stage 9 isolation', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const rail = read('components/saina/SainaYansiContextRail.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');

  it('does not invent handle, Bilgin badge, or 8-step progress', () => {
    expect(hero).not.toContain('>Bilgin<');
    expect(hero).not.toContain('kullanıcı adı');
    expect(hero).not.toContain('bilign-progress');
    expect(css).not.toContain('bilign-progress');
  });

  it('keeps Ayna reachable through the context rail', () => {
    expect(rail).toContain('onOpenAyna');
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('tryOpenMirror');
  });

  it('marks empty conversation stack without inventing chat chrome', () => {
    expect(shell).toContain("isEmpty && 'saina-main-body--empty'");
    expect(shell).toContain("isEmpty && 'saina-chat-column--empty'");
  });

  it('does not restyle Discover, ranking, or profile surfaces', () => {
    expect(css).not.toContain('saina-discover-shell');
    expect(css).not.toContain('strong_curiosity');
    expect(css).not.toContain('bilign-profile');
  });

  it('gates desktop visual system at 900px so Phase 8.7 mobile remains default', () => {
    expect(css).toContain('Mobile (<900px) keeps existing Phase 8.7 layout');
    expect(css).toMatch(/\.bilign-yansi-identity__mark \{\s*display: none;/);
  });
});

describe('Phase 8.8F Stage A Yansı-first composition', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const rail = read('components/saina/SainaYansiContextRail.tsx');

  it('dissolves the central chat window into a localized reading plane', () => {
    expect(css).toContain('editorial reading plane (not a chat window)');
    expect(css).toContain('rgba(10, 12, 12, 0.66)');
    expect(css).toContain('mask-composite: intersect');
    expect(css).toContain('overflow: visible');
    expect(css).not.toContain('rgba(18, 20, 20, 0.80)');
    expect(css).not.toContain('cream border (not bronze geometry)');
  });

  it('keeps conversation below 780px without bronze/gold card geometry', () => {
    expect(css).toContain('min(760px');
    expect(css).not.toContain('min(820px');
    expect(css).not.toContain('rgba(231, 180, 91');
    expect(css).not.toContain('0 0 120px');
  });

  it('places Yansı identity in the scene and pins conversation to the lower reading zone', () => {
    expect(css).toContain('clamp(26px, 2.05vw, 34px)');
    expect(css).toContain('-webkit-line-clamp: 2');
    expect(css).toContain('margin-top: auto');
    expect(css).toContain('justify-content: flex-start');
    expect(css).toContain('width: 56px');
    expect(hero).not.toContain('>Bilgin<');
  });

  it('lightens global scene veil so darkness stays behind text, not the whole Yansı', () => {
    expect(css).toContain('transparent 42%');
    expect(css).toContain('brightness(0.94)');
    expect(css).not.toContain('--mirror-focal-position');
    const scene = read('styles/saina-mirror.css');
    expect(scene).toContain('--mirror-focal-position');
  });

  it('keeps continuation composer, Ayna wiring, sidebar, and isolation untouched in product terms', () => {
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
    expect(css).toContain('margin-top: 12px');
    expect(css).toContain('--saina-sidebar-width: 280px');
    expect(shell).toContain('tryOpenMirror');
    expect(rail).toContain('onOpenAyna');
    expect(css).not.toContain('saina-discover-shell');
    expect(css).not.toContain('bilign-progress');
  });
});
