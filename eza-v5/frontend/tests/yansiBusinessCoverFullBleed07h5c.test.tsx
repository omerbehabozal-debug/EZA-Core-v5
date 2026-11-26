/**
 * 07H.5C — Business cover full-bleed parity with individual Yansı cinematic crop.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';

const BIZ = '11111111-1111-1111-1111-111111111111';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COVER = `/api/business-yansi/public-media/${BIZ}/${ASSET}`;

describe('07H.5C Business cover full-bleed', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('Deneyimle identity layer uses cover (not contain) even with preserveFrame', async () => {
    render(<SainaCinematicScene sceneImageUrl={COVER} preserveFrame />);
    const identity = await waitFor(() => screen.getByTestId('saina-scene-identity-layer'));
    expect(identity).toHaveAttribute('data-saina-scene-fit', 'cover');
    expect(identity.getAttribute('style') || '').not.toMatch(/background-size:\s*contain/i);
    expect(identity.style.backgroundImage).toContain(COVER);
  });

  it('fullscreen mobile + desktop brand covers use cover crop classes', () => {
    const { rerender } = render(
      <MirrorYansiSceneCrossfade
        sceneImageUrl="https://cdn.example/square-1024.jpg"
        presentation="mobile-fullscreen"
        brandCover
      />
    );
    expect(screen.getByTestId('mirror-yansi-scene-current').className).toContain('object-cover');
    expect(screen.getByTestId('mirror-yansi-scene-current').className).not.toContain(
      'object-contain'
    );

    rerender(
      <MirrorYansiSceneCrossfade
        sceneImageUrl="https://cdn.example/portrait.jpg"
        presentation="desktop-immersive"
        brandCover
      />
    );
    expect(screen.getByTestId('mirror-yansi-scene-current').className).toContain(
      'yansi-desktop-scene-image'
    );
    expect(screen.getByTestId('mirror-yansi-scene-current').className).not.toContain(
      'object-contain'
    );
  });

  it('reel CSS keeps brand covers on shared cover fit variable', () => {
    const css = readFileSync(
      join(process.cwd(), 'styles/yansi-reel-responsive.css'),
      'utf8'
    );
    expect(css).toMatch(
      /\.yansi-desktop-scene-image\[data-yansi-brand-cover='true'\]\s*\{[^}]*object-fit:\s*var\(--yansi-scene-fit,\s*cover\)/s
    );
    expect(css).not.toMatch(
      /\.yansi-desktop-scene-image\[data-yansi-brand-cover='true'\]\s*\{[^}]*object-fit:\s*contain/s
    );
  });

  it('SainaCinematicScene source no longer forces contain for preserveFrame', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/saina/SainaCinematicScene.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/backgroundSize:\s*['"]contain['"]/);
  });

  it('load error falls back to bundled default without identity layer', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        naturalWidth = 0;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    render(<SainaCinematicScene sceneImageUrl={COVER} preserveFrame />);
    // Optimistic cover first — cityscape only after confirmed failure.
    expect(screen.getByTestId('saina-scene-identity-layer')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('saina-scene-identity-layer')).toBeNull()
    );
    expect(screen.getByTestId('saina-scene-image-layer')).toBeInTheDocument();
  });
});
